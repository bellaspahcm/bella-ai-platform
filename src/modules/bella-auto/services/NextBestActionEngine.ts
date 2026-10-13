/**
 * AI Next Best Action Engine
 * Analyzes customer behavior and generates intelligent action recommendations
 * for sales team to improve conversion and retention
 * 
 * @module bella-auto/services/NextBestActionEngine
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import {
  listMobilityCustomerOwnedVehicles,
  type MobilityCustomerOwnedVehicle,
} from '@/platform/mobility/supabase-vehicle-contract';
import { Database, type Json } from '@/types/database.types';

type NextBestAction = Database['public']['Tables']['auto_next_best_actions']['Row'];
type NextBestActionInsert = Database['public']['Tables']['auto_next_best_actions']['Insert'];
type NextBestActionUpdate = Database['public']['Tables']['auto_next_best_actions']['Update'];

interface QueryResult<Row> {
  data: Row[] | null;
  error: { message: string } | null;
}

interface SingleResult<Row> {
  data: Row | null;
  error: { message: string } | null;
}

interface AutoQuery<Row> extends PromiseLike<QueryResult<Row>> {
  eq(column: string, value: unknown): AutoQuery<Row>;
  gte(column: string, value: unknown): AutoQuery<Row>;
  limit(count: number): AutoQuery<Row>;
  order(column: string, options?: { ascending?: boolean }): AutoQuery<Row>;
  select<NextRow = Row>(columns?: string): AutoQuery<NextRow>;
  single(): PromiseLike<SingleResult<Row>>;
}

interface AutoTable {
  select<Row>(columns?: string): AutoQuery<Row>;
}

interface AutoClient {
  from(table: string): AutoTable;
}

interface QuotationRow {
  created_at: string;
  id: string;
  total_amount: number | null;
}

interface TestDriveRow {
  completed_at: string | null;
  customer_feedback: string | null;
  id: string;
  scheduled_date: string;
  status: string | null;
  vehicle_model: string | null;
}

interface TouchpointRow {
  interacted_at: string;
}

interface ServiceAppointmentRow {
  appointment_date: string;
  service_type: string | null;
}

interface JourneyStageReferenceRow {
  current_stage_id: string;
}

interface JourneyStageRow {
  code: string;
}

function autoClient(client: unknown): AutoClient {
  return client as AutoClient;
}

function toJson(value: unknown): Json {
  const serialized: unknown = JSON.parse(JSON.stringify(value));
  return serialized as Json;
}

function readMetadataString(metadata: Json | null | undefined, keys: string[]): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  return null;
}

function vehicleDisplayName(vehicle: MobilityCustomerOwnedVehicle): string {
  const displayName = [vehicle.brandName, vehicle.modelName, vehicle.variantName]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return displayName || vehicle.vin || vehicle.vehicleId;
}

export interface ActionRecommendation {
  actionType: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reason: string;
  confidenceScore: number;
  dataPoints: Record<string, unknown>;
  validUntil: Date;
}

export class NextBestActionEngine {
  /**
   * Generate next best action recommendations for a customer
   */
  static async generateRecommendations(
    tenantId: string,
    customerId: string,
    journeyId?: string
  ): Promise<NextBestAction[]> {
    const recommendations: ActionRecommendation[] = [];

    // Analyze different signals
    const quotationSignals = await this.analyzeQuotationBehavior(tenantId, customerId, journeyId);
    const testDriveSignals = await this.analyzeTestDriveBehavior(tenantId, customerId, journeyId);
    const engagementSignals = await this.analyzeEngagementLevel(tenantId, customerId);
    const satisfactionSignals = await this.analyzeSatisfactionScores(tenantId, customerId);
    const serviceSignals = await this.analyzeServiceHistory(tenantId, customerId);
    const lifeEventSignals = await this.detectLifeEvents(tenantId, customerId);

    recommendations.push(
      ...quotationSignals,
      ...testDriveSignals,
      ...engagementSignals,
      ...satisfactionSignals,
      ...serviceSignals,
      ...lifeEventSignals
    );

    // Sort by priority and confidence
    const sortedRecommendations = recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidenceScore - a.confidenceScore;
    });

    // Save top recommendations to database
    const savedActions: NextBestAction[] = [];
    for (const rec of sortedRecommendations.slice(0, 5)) {
      const action = await this.saveRecommendation(tenantId, customerId, journeyId, rec);
      savedActions.push(action);
    }

    return savedActions;
  }

  /**
   * Analyze quotation behavior
   */
  private static async analyzeQuotationBehavior(
    tenantId: string,
    customerId: string,
    journeyId?: string
  ): Promise<ActionRecommendation[]> {
    const supabase = autoClient(getPrimaryClient());
    const recommendations: ActionRecommendation[] = [];
    const now = new Date();

    // Check for quotations sent but not followed up
    const { data: quotations } = await supabase
      .from('auto_quotations')
      .select<QuotationRow>('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('status', 'sent')
      .order('created_at', { ascending: false });

    if (quotations && quotations.length > 0) {
      const latestQuotation = quotations[0];
      const daysSinceSent = Math.floor(
        (now.getTime() - new Date(latestQuotation.created_at).getTime()) / (24 * 60 * 60 * 1000)
      );

      // 5+ days with no follow-up
      if (daysSinceSent >= 5 && daysSinceSent <= 14) {
        recommendations.push({
          actionType: 'follow_up_quotation',
          priority: 'high',
          title: 'Gọi điện chăm sóc báo giá',
          description: `Khách hàng nhận báo giá ${daysSinceSent} ngày trước nhưng chưa phản hồi. Đề xuất: Gọi để tư vấn thêm, giải đáp thắc mắc về giá và điều kiện.`,
          reason: 'Quotation sent but no response after optimal follow-up window (5-14 days)',
          confidenceScore: 0.85,
          dataPoints: {
            quotation_id: latestQuotation.id,
            days_since_sent: daysSinceSent,
            quotation_amount: latestQuotation.total_amount,
          },
          validUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        });
      }

      // Multiple quotations, no conversion
      if (quotations.length >= 3) {
        recommendations.push({
          actionType: 'offer_special_deal',
          priority: 'high',
          title: 'Đề xuất ưu đãi đặc biệt',
          description: `Khách hàng đã nhận ${quotations.length} báo giá nhưng chưa quyết định. Đề xuất: Tạo ưu đãi đặc biệt có thời hạn để thúc đẩy quyết định.`,
          reason: 'Multiple quotations without conversion indicates price sensitivity or hesitation',
          confidenceScore: 0.78,
          dataPoints: {
            quotation_count: quotations.length,
            total_quoted_value: quotations.reduce((sum, q) => sum + (q.total_amount || 0), 0),
          },
          validUntil: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        });
      }
    }

    return recommendations;
  }

  /**
   * Analyze test drive behavior
   */
  private static async analyzeTestDriveBehavior(
    tenantId: string,
    customerId: string,
    journeyId?: string
  ): Promise<ActionRecommendation[]> {
    const supabase = autoClient(getPrimaryClient());
    const recommendations: ActionRecommendation[] = [];
    const now = new Date();

    // Check test drive appointments
    const { data: testDrives } = await supabase
      .from('auto_test_drives')
      .select<TestDriveRow>('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('scheduled_date', { ascending: false });

    if (testDrives && testDrives.length > 0) {
      const latestTestDrive = testDrives[0];

      // Completed test drive, no quotation yet
      if (latestTestDrive.status === 'completed') {
        const daysSinceTestDrive = Math.floor(
          (now.getTime() - new Date(latestTestDrive.completed_at || latestTestDrive.scheduled_date).getTime()) / 
          (24 * 60 * 60 * 1000)
        );

        // Check if quotation was sent after test drive
        const { data: postTestDriveQuotation } = await supabase
          .from('auto_quotations')
          .select<{ id: string }>('id')
          .eq('tenant_id', tenantId)
          .eq('customer_id', customerId)
          .gte('created_at', latestTestDrive.completed_at || latestTestDrive.scheduled_date)
          .single();

        if (!postTestDriveQuotation && daysSinceTestDrive <= 3) {
          recommendations.push({
            actionType: 'send_quotation_after_test_drive',
            priority: 'critical',
            title: 'Gửi báo giá sau lái thử',
            description: `Khách đã lái thử ${daysSinceTestDrive} ngày trước nhưng chưa nhận báo giá. Strike while the iron is hot!`,
            reason: 'Test drive completed but no quotation sent - high conversion opportunity',
            confidenceScore: 0.92,
            dataPoints: {
              test_drive_id: latestTestDrive.id,
              days_since_test_drive: daysSinceTestDrive,
              vehicle_model: latestTestDrive.vehicle_model,
            },
            validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          });
        }

        // Test drive with positive feedback
        if (latestTestDrive.customer_feedback?.includes('thích') || 
            latestTestDrive.customer_feedback?.includes('hài lòng')) {
          recommendations.push({
            actionType: 'close_deal',
            priority: 'critical',
            title: 'Chốt đơn - Feedback tích cực',
            description: `Khách hài lòng sau lái thử. Đề xuất: Đàm phán điều kiện và chốt cọc ngay.`,
            reason: 'Positive test drive feedback indicates strong purchase intent',
            confidenceScore: 0.88,
            dataPoints: {
              test_drive_id: latestTestDrive.id,
              feedback: latestTestDrive.customer_feedback,
            },
            validUntil: new Date(now.getTime() + 48 * 60 * 60 * 1000),
          });
        }
      }

      // Scheduled but not confirmed
      if (latestTestDrive.status === 'scheduled') {
        const daysTilAppointment = Math.floor(
          (new Date(latestTestDrive.scheduled_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );

        if (daysTilAppointment >= 0 && daysTilAppointment <= 2) {
          recommendations.push({
            actionType: 'confirm_test_drive',
            priority: 'high',
            title: 'Nhắc lịch lái thử',
            description: `Lái thử đã đặt cho ${daysTilAppointment === 0 ? 'hôm nay' : `${daysTilAppointment} ngày nữa`}. Gọi xác nhận và nhắc nhở.`,
            reason: 'Upcoming test drive needs confirmation to reduce no-shows',
            confidenceScore: 0.95,
            dataPoints: {
              test_drive_id: latestTestDrive.id,
              days_until_appointment: daysTilAppointment,
            },
            validUntil: new Date(latestTestDrive.scheduled_date),
          });
        }
      }
    } else if (journeyId) {
      // No test drive scheduled yet, but in consideration stage
      const { data: journey } = await supabase
        .from('auto_customer_journeys')
        .select<JourneyStageReferenceRow>('current_stage_id')
        .eq('id', journeyId)
        .single();

      const { data: currentStage } = journey
        ? await supabase
            .from('auto_journey_stages')
            .select<JourneyStageRow>('code')
            .eq('id', journey.current_stage_id)
            .single()
        : { data: null };

      if (currentStage?.code === 'consideration' || currentStage?.code === 'evaluation') {
        recommendations.push({
          actionType: 'schedule_test_drive',
          priority: 'high',
          title: 'Đề xuất lái thử',
          description: 'Khách đang trong giai đoạn cân nhắc. Đề xuất đặt lịch lái thử để tăng cơ hội chốt.',
          reason: 'Customer in consideration stage - test drive increases conversion significantly',
          confidenceScore: 0.80,
          dataPoints: {
            journey_stage: currentStage.code,
          },
          validUntil: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        });
      }
    }

    return recommendations;
  }

  /**
   * Analyze engagement level
   */
  private static async analyzeEngagementLevel(
    tenantId: string,
    customerId: string
  ): Promise<ActionRecommendation[]> {
    const supabase = getPrimaryClient();
    const recommendations: ActionRecommendation[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get recent touchpoints
    const { data: touchpoints } = await supabase
      .from('auto_touchpoints')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .gte('interacted_at', thirtyDaysAgo.toISOString());

    const touchpointCount = touchpoints?.length || 0;

    // Low engagement
    if (touchpointCount === 0) {
      const { data: lastTouchpoint } = await supabase
        .from('auto_touchpoints')
        .select('interacted_at')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
        .order('interacted_at', { ascending: false })
        .limit(1)
        .single();

      if (lastTouchpoint) {
        const daysSinceLastContact = Math.floor(
          (now.getTime() - new Date(lastTouchpoint.interacted_at).getTime()) / (24 * 60 * 60 * 1000)
        );

        if (daysSinceLastContact >= 30 && daysSinceLastContact <= 90) {
          recommendations.push({
            actionType: 're_engage_customer',
            priority: 'medium',
            title: 'Kích hoạt lại khách hàng im lặng',
            description: `Không có tương tác trong ${daysSinceLastContact} ngày. Gọi điện hoặc gửi email với ưu đãi mới.`,
            reason: 'Customer disengagement - proactive outreach required',
            confidenceScore: 0.70,
            dataPoints: {
              days_since_last_contact: daysSinceLastContact,
            },
            validUntil: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Analyze satisfaction scores
   */
  private static async analyzeSatisfactionScores(
    tenantId: string,
    customerId: string
  ): Promise<ActionRecommendation[]> {
    const recommendations: ActionRecommendation[] = [];

    // This is already handled by NPS and CSI services
    // They create next best actions for detractors and low CSI
    // So we skip duplicate recommendations here

    return recommendations;
  }

  /**
   * Analyze service history
   */
  private static async analyzeServiceHistory(
    tenantId: string,
    customerId: string
  ): Promise<ActionRecommendation[]> {
    const supabase = getPrimaryClient();
    const autoSupabase = autoClient(supabase);
    const recommendations: ActionRecommendation[] = [];
    const now = new Date();

    const vehicles = await listMobilityCustomerOwnedVehicles(supabase, {
      tenantId,
      customerId,
    });

    if (vehicles && vehicles.length > 0) {
      for (const vehicle of vehicles) {
        // Check last service date
        const { data: lastService } = await autoSupabase
          .from('auto_service_appointments')
          .select<ServiceAppointmentRow>('appointment_date, service_type')
          .eq('tenant_id', tenantId)
          .eq('vehicle_id', vehicle.vehicleId)
          .eq('status', 'completed')
          .order('appointment_date', { ascending: false })
          .limit(1)
          .single();

        if (lastService) {
          const daysSinceService = Math.floor(
            (now.getTime() - new Date(lastService.appointment_date).getTime()) / (24 * 60 * 60 * 1000)
          );

          // Due for maintenance
          if (daysSinceService >= 150 && daysSinceService <= 200) {
            recommendations.push({
              actionType: 'schedule_maintenance',
              priority: 'medium',
              title: 'Nhắc lịch bảo dưỡng định kỳ',
              description: `Xe ${vehicleDisplayName(vehicle)} đã ${daysSinceService} ngày kể từ lần bảo dưỡng cuối. Đề xuất đặt lịch bảo dưỡng.`,
              reason: 'Vehicle due for scheduled maintenance based on time interval',
              confidenceScore: 0.85,
              dataPoints: {
                vehicle_id: vehicle.vehicleId,
                vehicle_model: vehicleDisplayName(vehicle),
                days_since_service: daysSinceService,
              },
              validUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            });
          }
        } else {
          // Never serviced - high priority
          const vehicleAge = Math.floor(
            (now.getTime() - new Date(vehicle.createdAt).getTime()) / (24 * 60 * 60 * 1000)
          );

          if (vehicleAge >= 90) {
            recommendations.push({
              actionType: 'first_service_reminder',
              priority: 'high',
              title: 'Nhắc bảo dưỡng lần đầu',
              description: `Xe ${vehicleDisplayName(vehicle)} đã ${vehicleAge} ngày nhưng chưa từng bảo dưỡng. Liên hệ khách hàng ngay.`,
              reason: 'Vehicle never serviced - critical for customer retention',
              confidenceScore: 0.90,
              dataPoints: {
                vehicle_id: vehicle.vehicleId,
                vehicle_model: vehicleDisplayName(vehicle),
                vehicle_age_days: vehicleAge,
              },
              validUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            });
          }
        }
      }
    }

    return recommendations;
  }

  /**
   * Detect life events that could trigger purchases
   */
  private static async detectLifeEvents(
    tenantId: string,
    customerId: string
  ): Promise<ActionRecommendation[]> {
    const supabase = getPrimaryClient();
    const recommendations: ActionRecommendation[] = [];
    const now = new Date();

    // Check purchase history for upgrade cycle
    const { data: purchases } = await supabase
      .from('auto_customer_journeys')
      .select('created_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    const completedPurchases = (purchases ?? []).filter((purchase) =>
      readMetadataString(purchase.metadata, ['status']) === 'completed' &&
      Boolean(readMetadataString(purchase.metadata, ['vehicle_id', 'vehicleId']))
    );

    if (completedPurchases.length > 0) {
      const lastPurchase = completedPurchases[0];
      const daysSinceLastPurchase = Math.floor(
        (now.getTime() - new Date(lastPurchase.created_at).getTime()) / (24 * 60 * 60 * 1000)
      );

      // 3-5 year upgrade cycle
      if (daysSinceLastPurchase >= 1095 && daysSinceLastPurchase <= 1825) {
        recommendations.push({
          actionType: 'offer_trade_in',
          priority: 'medium',
          title: 'Đề xuất Trade-in nâng cấp',
          description: `Khách mua xe ${Math.floor(daysSinceLastPurchase / 365)} năm trước. Đây là thời điểm lý tưởng để đề xuất trade-in và nâng cấp.`,
          reason: 'Customer approaching typical vehicle upgrade cycle (3-5 years)',
          confidenceScore: 0.75,
          dataPoints: {
            last_purchase_date: lastPurchase.created_at,
            years_since_purchase: Math.floor(daysSinceLastPurchase / 365),
          },
          validUntil: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        });
      }
    }

    return recommendations;
  }

  /**
   * Save recommendation to database
   */
  private static async saveRecommendation(
    tenantId: string,
    customerId: string,
    journeyId: string | undefined,
    recommendation: ActionRecommendation
  ): Promise<NextBestAction> {
    const supabase = getPrimaryClient();

    // Get journey assignment
    let assignedTo: string | null = null;
    if (journeyId) {
      const { data: journey } = await supabase
        .from('auto_customer_journeys')
        .select('metadata')
        .eq('id', journeyId)
        .single();
      
      assignedTo = journey
        ? readMetadataString(journey.metadata, ['assigned_to', 'assignedTo', 'sales_consultant_id'])
        : null;
    }

    const actionData: NextBestActionInsert = {
      tenant_id: tenantId,
      customer_id: customerId,
      journey_id: journeyId,
      action_type: recommendation.actionType,
      action_priority: recommendation.priority,
      action_title: recommendation.title,
      action_description: recommendation.description,
      reason: recommendation.reason,
      confidence_score: recommendation.confidenceScore,
      data_points: toJson(recommendation.dataPoints),
      assigned_to: assignedTo,
      status: 'pending',
      valid_until: recommendation.validUntil.toISOString(),
    };

    const { data, error } = await supabase
      .from('auto_next_best_actions')
      .insert(actionData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save recommendation: ${error.message}`);
    }

    return data;
  }

  /**
   * Get pending actions for a sales consultant
   */
  static async getPendingActions(
    tenantId: string,
    consultantId?: string,
    limit: number = 50
  ): Promise<NextBestAction[]> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_next_best_actions')
      .select('*, customers(*), auto_customer_journeys(*)')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .gte('valid_until', new Date().toISOString())
      .order('action_priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (consultantId) {
      query = query.eq('assigned_to', consultantId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get pending actions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update action status
   */
  static async updateActionStatus(
    actionId: string,
    tenantId: string,
    status: string,
    outcome?: string,
    outcomeNotes?: string
  ): Promise<void> {
    const supabase = getPrimaryClient();

    const updateData: NextBestActionUpdate = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
      updateData.outcome = outcome;
      updateData.outcome_notes = outcomeNotes;
    }

    const { error } = await supabase
      .from('auto_next_best_actions')
      .update(updateData)
      .eq('id', actionId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to update action status: ${error.message}`);
    }
  }
}
