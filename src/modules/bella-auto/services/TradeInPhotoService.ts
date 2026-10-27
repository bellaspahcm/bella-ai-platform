/**
 * Trade-In Photo Service
 * Manages multi-angle photo capture and storage for trade-in appraisals
 * 
 * @module bella-auto/services/TradeInPhotoService
 */

import { createClient } from '@/lib/supabase-client';
import type { Database, Json } from '@/types/database.types';

type TradeInPhoto = Database['public']['Tables']['auto_trade_in_photos']['Row'];
type TradeInPhotoInsert = Database['public']['Tables']['auto_trade_in_photos']['Insert'];
type TradeInPhotoUpdate = Database['public']['Tables']['auto_trade_in_photos']['Update'];

type DamageMarker = {
  x: number;
  y: number;
  label: string;
  severity: 'minor' | 'moderate' | 'severe';
};

export interface UploadPhotoData {
  tenantId: string;
  appraisalId: string;
  photoCategory: string;
  photoUrl: string;
  photoThumbnailUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  widthPx?: number;
  heightPx?: number;
  description?: string;
  notes?: string;
  damageMarkers?: DamageMarker[];
  displayOrder?: number;
  isPrimary?: boolean;
  uploadedBy?: string;
}

export interface PhotoCategory {
  key: string;
  label: string;
  description: string;
  required: boolean;
  maxPhotos: number;
}

export class TradeInPhotoService {
  /**
   * Standard photo categories for trade-in appraisals
   */
  static readonly PHOTO_CATEGORIES: PhotoCategory[] = [
    { key: 'front', label: 'Mặt trước', description: 'Toàn cảnh phía trước xe', required: true, maxPhotos: 1 },
    { key: 'rear', label: 'Mặt sau', description: 'Toàn cảnh phía sau xe', required: true, maxPhotos: 1 },
    { key: 'left_side', label: 'Bên trái', description: 'Toàn cảnh bên trái xe', required: true, maxPhotos: 1 },
    { key: 'right_side', label: 'Bên phải', description: 'Toàn cảnh bên phải xe', required: true, maxPhotos: 1 },
    { key: 'front_left_angle', label: 'Góc trước trái', description: 'Góc 45° trước trái', required: false, maxPhotos: 1 },
    { key: 'front_right_angle', label: 'Góc trước phải', description: 'Góc 45° trước phải', required: false, maxPhotos: 1 },
    { key: 'rear_left_angle', label: 'Góc sau trái', description: 'Góc 45° sau trái', required: false, maxPhotos: 1 },
    { key: 'rear_right_angle', label: 'Góc sau phải', description: 'Góc 45° sau phải', required: false, maxPhotos: 1 },
    { key: 'interior_dashboard', label: 'Taplo', description: 'Bảng điều khiển và taplo', required: true, maxPhotos: 1 },
    { key: 'interior_front_seats', label: 'Ghế trước', description: 'Hàng ghế trước', required: true, maxPhotos: 1 },
    { key: 'interior_rear_seats', label: 'Ghế sau', description: 'Hàng ghế sau', required: false, maxPhotos: 1 },
    { key: 'interior_trunk', label: 'Cốp xe', description: 'Khoang hành lý', required: false, maxPhotos: 1 },
    { key: 'engine_bay', label: 'Khoang máy', description: 'Động cơ và các bộ phận', required: true, maxPhotos: 2 },
    { key: 'odometer', label: 'Đồng hồ km', description: 'Số km hiện tại', required: true, maxPhotos: 1 },
    { key: 'vin_plate', label: 'Biển số khung', description: 'Biển số VIN', required: true, maxPhotos: 1 },
    { key: 'damage_specific', label: 'Hư hỏng cụ thể', description: 'Vết xước, móp méo, hỏng hóc', required: false, maxPhotos: 10 },
    { key: 'documents', label: 'Giấy tờ', description: 'Đăng ký, bảo hiểm, sách bảo hành', required: false, maxPhotos: 5 },
    { key: 'other', label: 'Khác', description: 'Ảnh khác', required: false, maxPhotos: 5 },
  ];

  /**
   * Upload a photo for trade-in appraisal
   */
  static async uploadPhoto(data: UploadPhotoData): Promise<TradeInPhoto> {
    const supabase = createClient();
    const damageMarkers: Json | undefined = data.damageMarkers?.map((marker) => ({
      x: marker.x,
      y: marker.y,
      label: marker.label,
      severity: marker.severity,
    }));

    const photoData: TradeInPhotoInsert = {
      tenant_id: data.tenantId,
      appraisal_id: data.appraisalId,
      photo_category: data.photoCategory,
      photo_url: data.photoUrl,
      photo_thumbnail_url: data.photoThumbnailUrl,
      file_name: data.fileName,
      file_size_bytes: data.fileSizeBytes,
      mime_type: data.mimeType,
      width_px: data.widthPx,
      height_px: data.heightPx,
      description: data.description,
      notes: data.notes,
      damage_markers: damageMarkers,
      display_order: data.displayOrder || 0,
      is_primary: data.isPrimary || false,
      uploaded_by: data.uploadedBy,
    };

    const { data: photo, error } = await supabase
      .from('auto_trade_in_photos')
      .insert(photoData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upload photo: ${error.message}`);
    }

    return photo;
  }

  /**
   * Get all photos for an appraisal
   */
  static async getPhotosForAppraisal(
    tenantId: string,
    appraisalId: string
  ): Promise<TradeInPhoto[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('auto_trade_in_photos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('appraisal_id', appraisalId)
      .order('display_order', { ascending: true })
      .order('uploaded_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get photos: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get photos by category
   */
  static async getPhotosByCategory(
    tenantId: string,
    appraisalId: string,
    category: string
  ): Promise<TradeInPhoto[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('auto_trade_in_photos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('appraisal_id', appraisalId)
      .eq('photo_category', category)
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to get photos: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Set primary photo
   */
  static async setPrimaryPhoto(
    photoId: string,
    tenantId: string,
    appraisalId: string
  ): Promise<TradeInPhoto> {
    const supabase = createClient();

    // First, unset all primary photos for this appraisal
    await supabase
      .from('auto_trade_in_photos')
      .update({ is_primary: false })
      .eq('tenant_id', tenantId)
      .eq('appraisal_id', appraisalId);

    // Set the new primary photo
    const { data: photo, error } = await supabase
      .from('auto_trade_in_photos')
      .update({ is_primary: true })
      .eq('id', photoId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set primary photo: ${error.message}`);
    }

    return photo;
  }

  /**
   * Update photo metadata
   */
  static async updatePhotoMetadata(
    photoId: string,
    tenantId: string,
    metadata: {
      description?: string;
      notes?: string;
      damageMarkers?: Json;
      displayOrder?: number;
    }
  ): Promise<TradeInPhoto> {
    const supabase = createClient();

    const updateData: TradeInPhotoUpdate = {};
    if (metadata.description !== undefined) updateData.description = metadata.description;
    if (metadata.notes !== undefined) updateData.notes = metadata.notes;
    if (metadata.damageMarkers !== undefined) updateData.damage_markers = metadata.damageMarkers;
    if (metadata.displayOrder !== undefined) updateData.display_order = metadata.displayOrder;

    const { data: photo, error } = await supabase
      .from('auto_trade_in_photos')
      .update(updateData)
      .eq('id', photoId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update photo: ${error.message}`);
    }

    return photo;
  }

  /**
   * Delete a photo
   */
  static async deletePhoto(
    photoId: string,
    tenantId: string
  ): Promise<void> {
    const supabase = createClient();

    // Get photo details before deletion (for storage cleanup)
    const { data: photo } = await supabase
      .from('auto_trade_in_photos')
      .select('photo_url')
      .eq('id', photoId)
      .eq('tenant_id', tenantId)
      .single();

    // Delete from database
    const { error } = await supabase
      .from('auto_trade_in_photos')
      .delete()
      .eq('id', photoId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete photo: ${error.message}`);
    }

    // TODO: Delete from storage (Supabase Storage or S3)
    if (photo?.photo_url) {
      console.log(`[TradeInPhoto] Storage cleanup needed: ${photo.photo_url}`);
    }
  }

  /**
   * Check photo completion status
   */
  static async checkPhotoCompletionStatus(
    tenantId: string,
    appraisalId: string
  ): Promise<{
    isComplete: boolean;
    requiredCategories: string[];
    missingCategories: string[];
    totalPhotos: number;
    photosByCategory: Record<string, number>;
  }> {
    const photos = await this.getPhotosForAppraisal(tenantId, appraisalId);

    const photosByCategory: Record<string, number> = {};
    photos.forEach(photo => {
      photosByCategory[photo.photo_category] = (photosByCategory[photo.photo_category] || 0) + 1;
    });

    const requiredCategories = this.PHOTO_CATEGORIES
      .filter(cat => cat.required)
      .map(cat => cat.key);

    const missingCategories = requiredCategories.filter(
      cat => !photosByCategory[cat] || photosByCategory[cat] === 0
    );

    return {
      isComplete: missingCategories.length === 0,
      requiredCategories,
      missingCategories,
      totalPhotos: photos.length,
      photosByCategory,
    };
  }

  /**
   * Reorder photos
   */
  static async reorderPhotos(
    tenantId: string,
    photoOrders: Array<{ photoId: string; displayOrder: number }>
  ): Promise<void> {
    const supabase = createClient();

    // Batch update
    for (const { photoId, displayOrder } of photoOrders) {
      await supabase
        .from('auto_trade_in_photos')
        .update({ display_order: displayOrder })
        .eq('id', photoId)
        .eq('tenant_id', tenantId);
    }
  }

  /**
   * Get primary photo for appraisal
   */
  static async getPrimaryPhoto(
    tenantId: string,
    appraisalId: string
  ): Promise<TradeInPhoto | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('auto_trade_in_photos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('appraisal_id', appraisalId)
      .eq('is_primary', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found", which is ok
      throw new Error(`Failed to get primary photo: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Batch upload photos
   */
  static async batchUploadPhotos(
    photos: UploadPhotoData[]
  ): Promise<TradeInPhoto[]> {
    const uploadedPhotos: TradeInPhoto[] = [];

    for (const photoData of photos) {
      const photo = await this.uploadPhoto(photoData);
      uploadedPhotos.push(photo);
    }

    return uploadedPhotos;
  }

  /**
   * Get photo categories with status
   */
  static async getPhotoCategoriesWithStatus(
    tenantId: string,
    appraisalId: string
  ): Promise<Array<PhotoCategory & { count: number; hasPhotos: boolean; isComplete: boolean }>> {
    const photos = await this.getPhotosForAppraisal(tenantId, appraisalId);

    const photosByCategory: Record<string, number> = {};
    photos.forEach(photo => {
      photosByCategory[photo.photo_category] = (photosByCategory[photo.photo_category] || 0) + 1;
    });

    return this.PHOTO_CATEGORIES.map(category => ({
      ...category,
      count: photosByCategory[category.key] || 0,
      hasPhotos: (photosByCategory[category.key] || 0) > 0,
      isComplete: category.required ? (photosByCategory[category.key] || 0) > 0 : true,
    }));
  }
}
