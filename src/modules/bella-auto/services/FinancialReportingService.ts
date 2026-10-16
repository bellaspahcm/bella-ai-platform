/**
 * Bella Auto Phase 8 - Financial Reporting Service
 * 
 * Provides financial analytics and reporting specific to automotive business.
 * 
 * Features:
 * - Gross profit margin per vehicle sold
 * - Service center revenue analytics
 * - Commission tracking (bank loans, insurance, accessories)
 * - Revenue breakdown by source
 * - Financial performance metrics
 * 
 * @module bella-auto/services/FinancialReportingService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { listMobilityVehicleDisplayByIds } from '@/platform/mobility/supabase-vehicle-contract';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export interface RecognizedSalesDashboard {
  summary: { revenue: number; sales: number; averageSalePrice: number };
  revenueByMonth: Array<{ month: string; revenue: number; sales: number }>;
  topModels: Array<{ model: string; sold: number; revenue: number }>;
  timeZone: 'UTC';
}

export class RecognizedSalesReadError extends Error {
  constructor(message: string, readonly status: 401 | 403 | 503) {
    super(message);
    this.name = 'RecognizedSalesReadError';
  }
}

interface DateRange {
  start: string;
  end: string;
}

interface RecognitionRow extends Record<string, unknown> {
  id: string;
  vehicle_id: string;
  sale_price_recognized: number | string | null;
  cost_basis_at_sale: number | string | null;
  recognized_at: string;
  recognized_by_user_id: string | null;
}

interface RecognitionAdjustmentRow extends Record<string, unknown> {
  recognition_id: string;
  sale_price_delta: number | string | null;
  cost_basis_delta: number | string | null;
  adjustment_type?: string;
}

interface RepairOrderRow {
  id: string;
  actual_labor_cost: number | null;
  actual_parts_cost: number | null;
  actual_total: number | null;
  order_type: string | null;
}

interface LoanRow {
  referral_commission_amount: number | null;
  commission_paid: boolean | null;
}

interface InsurancePolicyRow {
  referral_commission_amount: number | null;
  commission_paid: boolean | null;
}

interface TradeInRow {
  final_trade_in_value: number | null;
}

interface ExpenseRow {
  amount: number | null;
}

interface LegacyQueryResult<Row> {
  data: Row[] | null;
  error: { message: string } | null;
}

interface LegacyQuery<Row> extends PromiseLike<LegacyQueryResult<Row>> {
  eq(column: string, value: unknown): LegacyQuery<Row>;
  gte(column: string, value: unknown): LegacyQuery<Row>;
  in(column: string, values: readonly unknown[]): LegacyQuery<Row>;
  lte(column: string, value: unknown): LegacyQuery<Row>;
  order(column: string, options?: { ascending?: boolean }): LegacyQuery<Row>;
  range(from: number, to: number): LegacyQuery<Row>;
  returns(): LegacyQuery<Row>;
}

interface LegacyTable {
  select<Row>(columns: string): LegacyQuery<Row>;
}

interface FinancialReportingClient {
  from(table: string): LegacyTable;
}

function financialReportingClient(client: unknown): FinancialReportingClient {
  return client as FinancialReportingClient;
}

interface VehicleProfitMargin {
  saleId: string;
  vehicleId: string;
  vehicleMake: string;
  vehicleModel: string;
  salePrice: number;
  costPrice: number;
  grossProfit: number;
  profitMargin: number; // percentage
  saleDate: string;
  salesperson: string;
}

interface ServiceRevenue {
  totalRevenue: number;
  serviceCount: number;
  averageTicket: number;
  revenueByType: {
    maintenance: number;
    repair: number;
    warranty: number;
  };
  partsRevenue: number;
  laborRevenue: number;
}

interface CommissionBreakdown {
  totalCommission: number;
  vehicleSalesCommission: number;
  loanReferralCommission: number;
  insuranceReferralCommission: number;
  accessoriesCommission: number;
  commissionPaid: number;
  commissionPending: number;
}

interface RevenueBreakdown {
  totalRevenue: number;
  vehicleSales: number;
  serviceMaintenance: number;
  accessories: number;
  loanReferral: number;
  insuranceReferral: number;
  tradeIn: number;
}

interface FinancialMetrics {
  grossRevenue: number;
  netRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossProfitMargin: number; // percentage
  operatingExpenses: number;
  netProfit: number;
  netProfitMargin: number; // percentage
  vehiclesSold: number;
  averageVehiclePrice: number;
  averageProfitPerVehicle: number;
}

interface RecognizedVehicleSale {
  recognitionId: string;
  vehicleId: string;
  vehicleMake: string;
  vehicleModel: string;
  salePrice: number;
  costPrice: number;
  recognizedAt: string;
  recognizedByUserId: string | null;
}

export class FinancialReportingService {
  static async getRecognizedSalesDashboard(
    supabase: SupabaseClient<Database>,
    now = new Date()
  ): Promise<RecognizedSalesDashboard> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError?.status && authError.status >= 500) throw new RecognizedSalesReadError('Unable to verify authentication', 503);
    if (authError || !user) throw new RecognizedSalesReadError('Unauthorized', 401);
    const { data: profile, error: profileError } = await supabase.from('users')
      .select('tenant_id, status').eq('id', user.id).single();
    if (profileError) throw new RecognizedSalesReadError('Unable to verify actor', ['PGRST116', '42501'].includes(profileError.code) ? 403 : 503);
    if (!profile?.tenant_id || profile.status !== 'active') {
      throw new RecognizedSalesReadError('Active tenant identity required', 403);
    }
    const { data: tenant, error: tenantError } = await supabase.from('tenants')
      .select('id, status').eq('id', profile.tenant_id).single();
    if (tenantError) throw new RecognizedSalesReadError('Unable to verify tenant', ['PGRST116', '42501'].includes(tenantError.code) ? 403 : 503);
    if (!tenant || tenant.status !== 'active') {
      throw new RecognizedSalesReadError('Active tenant required', 403);
    }
    const sales = await this.getRecognizedVehicleSales(profile.tenant_id, undefined, supabase);
    const revenueByMonth = Array.from({ length: 6 }, (_, index) => ({
      month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1))
        .toISOString().slice(0, 7),
      revenue: 0,
      sales: 0,
    }));
    const models = new Map<string, { model: string; sold: number; revenue: number }>();
    let totalRevenue = 0;
    for (const sale of sales) {
      if (!Number.isSafeInteger(sale.salePrice)) {
        throw new RecognizedSalesReadError('Invalid recognized revenue amount', 503);
      }
      totalRevenue += sale.salePrice;
      if (!Number.isSafeInteger(totalRevenue)) throw new RecognizedSalesReadError('Invalid recognized revenue amount', 503);
      const month = revenueByMonth.find(item => item.month === new Date(sale.recognizedAt).toISOString().slice(0, 7));
      if (month) { month.revenue += sale.salePrice; month.sales += 1; }
      const name = sale.vehicleMake === 'Unknown' ? 'Unknown model' : sale.vehicleMake;
      const model = models.get(name) ?? { model: name, sold: 0, revenue: 0 };
      model.sold += 1;
      model.revenue += sale.salePrice;
      if ((month && !Number.isSafeInteger(month.revenue)) || !Number.isSafeInteger(model.revenue)) {
        throw new RecognizedSalesReadError('Invalid recognized revenue amount', 503);
      }
      models.set(name, model);
    }
    return {
      summary: { revenue: totalRevenue, sales: sales.length, averageSalePrice: sales.length ? totalRevenue / sales.length : 0 },
      revenueByMonth,
      topModels: [...models.values()].sort((a, b) => b.sold - a.sold || b.revenue - a.revenue || a.model.localeCompare(b.model)).slice(0, 5),
      timeZone: 'UTC',
    };
  }

  private static async getRecognizedVehicleSales(
    tenantId: string,
    dateRange?: DateRange,
    authenticatedClient?: SupabaseClient<Database>
  ): Promise<RecognizedVehicleSale[]> {
    const supabase = authenticatedClient ?? getPrimaryClient();
    const reporting = financialReportingClient(supabase);

    let query = reporting
      .from('auto_vehicle_sale_recognitions')
      .select<RecognitionRow>(`
        id,
        vehicle_id,
        sale_price_recognized,
        cost_basis_at_sale,
        recognized_at,
        recognized_by_user_id
      `)
      .eq('tenant_id', tenantId);

    if (dateRange) {
      query = query
        .gte('recognized_at', dateRange.start)
        .lte('recognized_at', dateRange.end);
    }

    query = query.order('recognized_at', { ascending: false });
    if (authenticatedClient) query = query.order('id', { ascending: false });
    const { data, error } = await readReportingRows(query, Boolean(authenticatedClient));

    if (error) {
      throw new Error(`Failed to fetch recognized vehicle sales: ${error.message}`);
    }

    const recognitions = data ?? [];
    const recognitionIds = recognitions.map((row) => row.id);
    const adjustmentsByRecognitionId = await this.getRecognitionAdjustments(
      reporting,
      tenantId,
      recognitionIds,
      Boolean(authenticatedClient)
    );
    const displayByVehicleId = await this.getVehicleDisplayById(
      supabase,
      tenantId,
      recognitions.map((row) => row.vehicle_id),
      Boolean(authenticatedClient)
    );

    return recognitions.map((row) => {
      const adjustment = adjustmentsByRecognitionId.get(row.id) ?? {
        salePriceDelta: 0,
        costBasisDelta: 0,
        reversed: false,
      };
      const display = displayByVehicleId.get(row.vehicle_id);
      const parseMoney = authenticatedClient ? recognizedMoney : toMoney;
      const salePrice = parseMoney(row.sale_price_recognized) + adjustment.salePriceDelta;
      const costPrice = parseMoney(row.cost_basis_at_sale) + adjustment.costBasisDelta;

      if (adjustment.reversed) {
        if (salePrice !== 0 || costPrice !== 0) throw new RecognizedSalesReadError('Invalid reversal totals', 503);
        return null;
      }

      return {
        recognitionId: row.id,
        vehicleId: row.vehicle_id,
        vehicleMake: display?.modelName ?? 'Unknown',
        vehicleModel: display?.variantName ?? display?.vin ?? row.vehicle_id,
        salePrice,
        costPrice,
        recognizedAt: row.recognized_at,
        recognizedByUserId: row.recognized_by_user_id,
      };
    }).filter((sale): sale is RecognizedVehicleSale => sale !== null);
  }

  private static async getRecognitionAdjustments(
    reporting: FinancialReportingClient,
    tenantId: string,
    recognitionIds: readonly string[],
    paginated = false
  ): Promise<Map<string, { salePriceDelta: number; costBasisDelta: number; reversed: boolean }>> {
    if (recognitionIds.length === 0) return new Map();

    const adjustments = new Map<string, { salePriceDelta: number; costBasisDelta: number; reversed: boolean }>();
    const chunks = paginated ? chunkIds(recognitionIds) : [recognitionIds];
    for (const ids of chunks) {
      let query = reporting
        .from('auto_vehicle_sale_recognition_adjustments')
        .select<RecognitionAdjustmentRow>(`
          recognition_id,
          sale_price_delta,
          cost_basis_delta,
          adjustment_type
        `)
        .eq('tenant_id', tenantId)
        .in('recognition_id', ids);
      if (paginated) query = query.order('id', { ascending: true });
      const { data, error } = await readReportingRows(query, paginated);

      if (error) {
        throw new Error(`Failed to fetch vehicle sale recognition adjustments: ${error.message}`);
      }

      for (const row of data ?? []) {
        const current = adjustments.get(row.recognition_id) ?? {
          salePriceDelta: 0,
          costBasisDelta: 0,
          reversed: false,
        };

        const parseMoney = paginated ? recognizedMoney : toMoney;
        current.salePriceDelta += parseMoney(row.sale_price_delta);
        current.costBasisDelta += parseMoney(row.cost_basis_delta);
        current.reversed ||= row.adjustment_type === 'sale_revenue_reversed';
        if (paginated && (!Number.isSafeInteger(current.salePriceDelta) || !Number.isSafeInteger(current.costBasisDelta))) {
          throw new RecognizedSalesReadError('Invalid recognized adjustment amount', 503);
        }
        adjustments.set(row.recognition_id, current);
      }
    }

    return adjustments;
  }

  private static async getVehicleDisplayById(
    supabase: unknown,
    tenantId: string,
    vehicleIds: readonly string[],
    paginated = false
  ) {
    const display = new Map<string, Awaited<ReturnType<typeof listMobilityVehicleDisplayByIds>>[number]>();
    for (const ids of paginated ? chunkIds([...new Set(vehicleIds)]) : [vehicleIds]) {
      const rows = await listMobilityVehicleDisplayByIds(
        supabase as Parameters<typeof listMobilityVehicleDisplayByIds>[0],
        { tenantId, vehicleIds: ids }
      );
      for (const row of rows) display.set(row.vehicleId, row);
    }
    return display;
  }

  /**
   * Calculate profit margin for individual vehicle sales
   */
  static async getVehicleProfitMargins(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<VehicleProfitMargin[]> {
    const recognizedSales = await this.getRecognizedVehicleSales(tenantId, dateRange);

    const margins: VehicleProfitMargin[] = recognizedSales.map((sale) => {
      const salePrice = sale.salePrice;
      const costPrice = sale.costPrice;
      const grossProfit = salePrice - costPrice;
      const profitMargin = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0;
      
      return {
        saleId: sale.recognitionId,
        vehicleId: sale.vehicleId,
        vehicleMake: sale.vehicleMake,
        vehicleModel: sale.vehicleModel,
        salePrice,
        costPrice,
        grossProfit,
        profitMargin,
        saleDate: sale.recognizedAt,
        salesperson: sale.recognizedByUserId || 'Unknown',
      };
    });
    
    return margins;
  }
  
  /**
   * Get service center revenue analytics
   */
  static async getServiceRevenue(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<ServiceRevenue> {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_repair_orders')
      .select(`
        id,
        actual_labor_cost,
        actual_parts_cost,
        actual_total,
        order_type
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'completed');
    
    if (dateRange) {
      query = query
        .gte('completed_date', dateRange.start)
        .lte('completed_date', dateRange.end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch service revenue: ${error.message}`);
    }
    
    const revenue: ServiceRevenue = {
      totalRevenue: 0,
      serviceCount: data?.length || 0,
      averageTicket: 0,
      revenueByType: {
        maintenance: 0,
        repair: 0,
        warranty: 0,
      },
      partsRevenue: 0,
      laborRevenue: 0,
    };
    
    (data || []).forEach((order: RepairOrderRow) => {
      const totalAmount = Number(order.actual_total) || 0;
      const laborCost = Number(order.actual_labor_cost) || 0;
      const partsCost = Number(order.actual_parts_cost) || 0;
      
      revenue.totalRevenue += totalAmount;
      revenue.laborRevenue += laborCost;
      revenue.partsRevenue += partsCost;
      
      if (order.order_type === 'maintenance') {
        revenue.revenueByType.maintenance += totalAmount;
      } else if (order.order_type === 'repair') {
        revenue.revenueByType.repair += totalAmount;
      } else if (order.order_type === 'warranty') {
        revenue.revenueByType.warranty += totalAmount;
      }
    });
    
    revenue.averageTicket = revenue.serviceCount > 0 
      ? revenue.totalRevenue / revenue.serviceCount 
      : 0;
    
    return revenue;
  }
  
  /**
   * Get commission breakdown
   */
  static async getCommissionBreakdown(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<CommissionBreakdown> {
    const supabase = getPrimaryClient();
    
    const breakdown: CommissionBreakdown = {
      totalCommission: 0,
      vehicleSalesCommission: 0,
      loanReferralCommission: 0,
      insuranceReferralCommission: 0,
      accessoriesCommission: 0,
      commissionPaid: 0,
      commissionPending: 0,
    };
    
    // Vehicle sales commission has no approved canonical source in the
    // recognition ledger yet, so it stays excluded from this read-side batch.
    
    // Get loan referral commission
    let loanQuery = supabase
      .from('auto_loan_applications')
      .select('referral_commission_amount, commission_paid')
      .eq('tenant_id', tenantId)
      .in('status', ['approved', 'disbursed']);
    
    if (dateRange) {
      loanQuery = loanQuery
        .gte('approved_at', dateRange.start)
        .lte('approved_at', dateRange.end);
    }
    
    const { data: loanData } = await loanQuery;
    
    (loanData || []).forEach((loan: LoanRow) => {
      const commission = Number(loan.referral_commission_amount) || 0;
      breakdown.loanReferralCommission += commission;
      
      if (loan.commission_paid) {
        breakdown.commissionPaid += commission;
      } else {
        breakdown.commissionPending += commission;
      }
    });
    
    // Get insurance referral commission
    let insuranceQuery = supabase
      .from('auto_insurance_policies')
      .select('referral_commission_amount, commission_paid')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');
    
    if (dateRange) {
      insuranceQuery = insuranceQuery
        .gte('effective_date', dateRange.start)
        .lte('effective_date', dateRange.end);
    }
    
    const { data: insuranceData } = await insuranceQuery;
    
    (insuranceData || []).forEach((policy: InsurancePolicyRow) => {
      const commission = Number(policy.referral_commission_amount) || 0;
      breakdown.insuranceReferralCommission += commission;
      
      if (policy.commission_paid) {
        breakdown.commissionPaid += commission;
      } else {
        breakdown.commissionPending += commission;
      }
    });
    
    breakdown.totalCommission = 
      breakdown.vehicleSalesCommission +
      breakdown.loanReferralCommission +
      breakdown.insuranceReferralCommission +
      breakdown.accessoriesCommission;
    
    return breakdown;
  }
  
  /**
   * Get revenue breakdown by source
   */
  static async getRevenueBreakdown(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<RevenueBreakdown> {
    const supabase = getPrimaryClient();
    
    const breakdown: RevenueBreakdown = {
      totalRevenue: 0,
      vehicleSales: 0,
      serviceMaintenance: 0,
      accessories: 0,
      loanReferral: 0,
      insuranceReferral: 0,
      tradeIn: 0,
    };
    
    const recognizedSales = await this.getRecognizedVehicleSales(tenantId, dateRange);
    breakdown.vehicleSales = recognizedSales.reduce(
      (sum, sale) => sum + sale.salePrice,
      0
    );
    
    // Service revenue
    const serviceRevenue = await this.getServiceRevenue(tenantId, dateRange);
    breakdown.serviceMaintenance = serviceRevenue.totalRevenue;
    
    // Commission revenue
    const commission = await this.getCommissionBreakdown(tenantId, dateRange);
    breakdown.loanReferral = commission.loanReferralCommission;
    breakdown.insuranceReferral = commission.insuranceReferralCommission;
    
    // Trade-in revenue (negative if we bought)
    let tradeInQuery = supabase
      .from('auto_trade_in_appraisals')
      .select('final_trade_in_value')
      .eq('tenant_id', tenantId)
      .eq('status', 'accepted');
    
    if (dateRange) {
      tradeInQuery = tradeInQuery
        .gte('accepted_at', dateRange.start)
        .lte('accepted_at', dateRange.end);
    }
    
    const { data: tradeInData } = await tradeInQuery;
    
    (tradeInData || []).forEach((appraisal: TradeInRow) => {
      breakdown.tradeIn += Number(appraisal.final_trade_in_value) || 0;
    });
    
    breakdown.totalRevenue = 
      breakdown.vehicleSales +
      breakdown.serviceMaintenance +
      breakdown.accessories +
      breakdown.loanReferral +
      breakdown.insuranceReferral -
      breakdown.tradeIn; // Trade-in is cost
    
    return breakdown;
  }
  
  /**
   * Get comprehensive financial metrics
   */
  static async getFinancialMetrics(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<FinancialMetrics> {
    const supabase = getPrimaryClient();
    
    // Get revenue breakdown
    const revenueBreakdown = await this.getRevenueBreakdown(tenantId, dateRange);
    
    // Get vehicle profit margins
    const profitMargins = await this.getVehicleProfitMargins(tenantId, dateRange);
    
    // Calculate costs from profit margins
    let totalCost = 0;
    profitMargins.forEach(margin => {
      totalCost += margin.costPrice;
    });
    
    // Get operating expenses from expenses table
    let expensesQuery = supabase
      .from('expenses')
      .select('amount')
      .eq('tenant_id', tenantId)
      .in('status', ['approved', 'paid']);
    
    if (dateRange) {
      expensesQuery = expensesQuery
        .gte('expense_date', dateRange.start)
        .lte('expense_date', dateRange.end);
    }
    
    const { data: expensesData } = await expensesQuery;
    
    let operatingExpenses = 0;
    (expensesData || []).forEach((expense: ExpenseRow) => {
      operatingExpenses += Number(expense.amount) || 0;
    });
    
    const grossRevenue = revenueBreakdown.totalRevenue;
    const grossProfit = grossRevenue - totalCost;
    const grossProfitMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;
    const netProfit = grossProfit - operatingExpenses;
    const netProfitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
    
    const vehiclesSold = profitMargins.length;
    const averageVehiclePrice = vehiclesSold > 0 
      ? revenueBreakdown.vehicleSales / vehiclesSold 
      : 0;
    const averageProfitPerVehicle = vehiclesSold > 0 
      ? profitMargins.reduce((sum, m) => sum + m.grossProfit, 0) / vehiclesSold 
      : 0;
    
    return {
      grossRevenue,
      netRevenue: grossRevenue,
      totalCost,
      grossProfit,
      grossProfitMargin,
      operatingExpenses,
      netProfit,
      netProfitMargin,
      vehiclesSold,
      averageVehiclePrice,
      averageProfitPerVehicle,
    };
  }
  
  /**
   * Get top performing vehicles by profit
   */
  static async getTopPerformingVehicles(
    tenantId: string,
    dateRange?: DateRange,
    limit: number = 10
  ): Promise<VehicleProfitMargin[]> {
    const margins = await this.getVehicleProfitMargins(tenantId, dateRange);
    
    return margins
      .sort((a, b) => b.grossProfit - a.grossProfit)
      .slice(0, limit);
  }
  
  /**
   * Get salesperson performance by commission
   */
  static async getSalespersonPerformance(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<Array<{
    salespersonId: string;
    vehiclesSold: number;
    totalRevenue: number;
    totalCommission: number;
    averageMargin: number;
  }>> {
    const margins = await this.getVehicleProfitMargins(tenantId, dateRange);
    
    const performanceMap = new Map<string, {
      vehiclesSold: number;
      totalRevenue: number;
      totalProfit: number;
      totalCommission: number;
    }>();
    
    margins.forEach(margin => {
      const existing = performanceMap.get(margin.salesperson) || {
        vehiclesSold: 0,
        totalRevenue: 0,
        totalProfit: 0,
        totalCommission: 0,
      };
      
      existing.vehiclesSold += 1;
      existing.totalRevenue += margin.salePrice;
      existing.totalProfit += margin.grossProfit;
      // Vehicle sales commission remains NOT_PROVEN in this batch.
      
      performanceMap.set(margin.salesperson, existing);
    });
    
    return Array.from(performanceMap.entries()).map(([salespersonId, data]) => ({
      salespersonId,
      vehiclesSold: data.vehiclesSold,
      totalRevenue: data.totalRevenue,
      totalCommission: data.totalCommission,
      averageMargin: data.vehiclesSold > 0 
        ? (data.totalProfit / data.totalRevenue) * 100 
        : 0,
    }));
  }
  
  /**
   * Generate monthly financial summary
   */
  static async getMonthlySummary(tenantId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    const dateRange = { start: startDate, end: endDate };
    
    const [metrics, revenueBreakdown, commission, serviceRevenue] = await Promise.all([
      this.getFinancialMetrics(tenantId, dateRange),
      this.getRevenueBreakdown(tenantId, dateRange),
      this.getCommissionBreakdown(tenantId, dateRange),
      this.getServiceRevenue(tenantId, dateRange),
    ]);
    
    return {
      period: { year, month, startDate, endDate },
      metrics,
      revenueBreakdown,
      commission,
      serviceRevenue,
    };
  }
}

function chunkIds(ids: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let offset = 0; offset < ids.length; offset += 100) chunks.push(ids.slice(offset, offset + 100));
  return chunks;
}

async function readReportingRows<Row>(query: LegacyQuery<Row>, paginated: boolean): Promise<LegacyQueryResult<Row>> {
  if (!paginated) return query;
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await query.range(offset, offset + 999);
    if (result.error) return result;
    rows.push(...result.data ?? []);
    if (!result.data || result.data.length < 1000) return { data: rows, error: null };
  }
}

function toMoney(value: number | string | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function recognizedMoney(value: number | string | null): number {
  const amount = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
  if (!Number.isSafeInteger(amount)) throw new RecognizedSalesReadError('Invalid recognized financial amount', 503);
  return amount;
}
