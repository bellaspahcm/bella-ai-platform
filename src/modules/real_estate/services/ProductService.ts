import { Database } from '@/types/database.types';
import { SupabaseClient } from '@supabase/supabase-js';
import type { ApartmentStatus } from '../contexts/inventory/domain/apartment';

type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];
type ProductUpdate = Database['public']['Tables']['real_estate_products']['Update'];

export class ProductService {
  /**
   * Create a new product (apartment/unit) within a project
   * Validates parent project ownership (Layer 5 cross-entity integrity)
   */
  static async createProduct(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    projectId: string,
    data: {
      product_code: string;
      product_type: 'apartment' | 'townhouse' | 'shophouse' | 'villa' | 'land_plot' | 'office';
      status?: 'available' | 'booked' | 'deposited' | 'contracted' | 'paid' | 'handed_over' | 'cancelled';
      area?: number | null;
      unit_price?: number | null;
      block?: string | null;
      floor?: string | null;
    }
  ): Promise<ProductRow> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    if (!projectId) {
      throw new Error('Project ID is required');
    }
    if (!data.product_code) {
      throw new Error('Product code is required');
    }

    // Layer 5: Verify parent project exists AND belongs to same tenant
    const { data: project, error: projectError } = await supabase
      .from('real_estate_projects')
      .select('tenant_id')
      .eq('id', projectId)
      .eq('tenant_id', tenantId)
      .single();

    if (projectError || !project) {
      console.error('[ProductService] Project not found or access denied:', projectError?.message);
      throw new Error('Project not found or access denied');
    }

    // Insert product with explicit tenant_id injection
    const { data: newProduct, error: insertError } = await supabase
      .from('real_estate_products')
      .insert({
        tenant_id: tenantId,
        project_id: projectId,
        product_code: data.product_code,
        product_type: data.product_type,
        status: data.status || 'available',
        area: data.area ?? undefined,
        unit_price: data.unit_price ?? undefined,
        block: data.block ?? null,
        floor: data.floor ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !newProduct) {
      console.error('[ProductService] Error creating product:', insertError?.message);
      throw new Error(insertError?.message || 'Failed to create product');
    }

    return newProduct;
  }

  /**
   * Fetch all products (units) inside a project for a given tenant
   */
  static async getProducts(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    projectId: string
  ): Promise<ProductRow[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const { data, error } = await supabase
      .from('real_estate_products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('product_code', { ascending: true });

    if (error) {
      console.error('[ProductService] Error fetching products:', error.message);
      throw error;
    }

    return data || [];
  }

  /**
   * Update product status and owner details, validating through Inventory State Machine
   */
  static async updateProductStatus(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    productId: string,
    targetStatus: ProductRow['status'],
    ownerName?: string | null
  ): Promise<ProductRow> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    if (!productId) {
      throw new Error('Product ID is required');
    }

    // 1. Fetch current status of the product under tenant scope
    const { data: product, error: fetchError } = await supabase
      .from('real_estate_products')
      .select('*')
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !product) {
      console.error('[ProductService] Product not found or access denied:', fetchError?.message);
      throw new Error(fetchError?.message || 'Product not found or access denied');
    }

    const currentStatus = product.status as ApartmentStatus;

    // 2. Validate state transition using Bounded Context Domain Model
    const { ApartmentDomainModel } = await import('../contexts/inventory/domain/apartment');
    const apartmentModel = new ApartmentDomainModel({
      id: product.id,
      projectId: product.project_id || '',
      unitCode: product.product_code,
      floor: product.floor ? parseInt(product.floor, 10) : 0,
      block: product.block || '',
      bedrooms: 0,
      bathrooms: 0,
      area: product.area || 0,
      price: product.unit_price || 0,
      status: currentStatus,
      ownerName: product.owner_name,
    });

    apartmentModel.transitionTo(targetStatus as ApartmentStatus, ownerName);


    // 3. Perform update (Zero Silent Failures - propagate errors)
    const updatePayload: ProductUpdate = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };

    if (ownerName !== undefined) {
      updatePayload.owner_name = ownerName;
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from('real_estate_products')
      .update(updatePayload)
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError || !updatedProduct) {
      console.error('[ProductService] Error updating product:', updateError?.message);
      throw new Error(updateError?.message || 'Failed to update product status');
    }

    // 4. Emit accounting outbox event for financial state transitions (Zero Direct Ledger Write)
    try {
      const { RealEstateAccountingService } = await import('./RealEstateAccountingService');
      await RealEstateAccountingService.emitStatusChangeEvent(
        supabase,
        tenantId,
        updatedProduct,
        targetStatus
      );
    } catch (acctErr) {
      console.warn('[ProductService] Warning: Failed to emit accounting event:', acctErr);
    }

    return updatedProduct;
  }

  /**
   * Update product general details (price, area, code, block, floor)
   */
  static async updateProductDetails(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    productId: string,
    payload: {
      unit_price?: number;
      area?: number;
      product_code?: string;
      product_type?: 'apartment' | 'townhouse' | 'shophouse' | 'villa' | 'land_plot' | 'office';
      block?: string | null;
      floor?: string | null;
    }
  ): Promise<ProductRow> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from('real_estate_products')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError || !updatedProduct) {
      console.error('[ProductService] Error updating product details:', updateError?.message);
      throw new Error(updateError?.message || 'Failed to update product details');
    }

    return updatedProduct;
  }
}

