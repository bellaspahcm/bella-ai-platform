/**
 * Service Appointment Service
 * Manages service bookings, scheduling, reminders, and appointment lifecycle
 * 
 * @module bella-auto/services/ServiceAppointmentService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type ServiceAppointment = Database['public']['Tables']['auto_service_appointments']['Row'];
type ServiceAppointmentInsert = Database['public']['Tables']['auto_service_appointments']['Insert'];
type ServiceAppointmentUpdate = Database['public']['Tables']['auto_service_appointments']['Update'];

function getCustomerDisplayName(customer: unknown): string {
  if (typeof customer === 'object' && customer !== null && 'name' in customer) {
    const name = customer.name;
    if (typeof name === 'string' && name.trim().length > 0) {
      return name;
    }
  }
  return 'customer';
}

export interface CreateAppointmentData {
  tenantId: string;
  customerId: string;
  vehicleId: string;
  appointmentDate: Date;
  appointmentTime: string; // HH:MM format
  serviceType: string;
  requestedServices: string;
  servicePackageId?: string;
  currentMileage?: number;
  reportedIssues?: string;
  estimatedDuration?: number;
}

export interface AppointmentStatusUpdate {
  status: string;
  notes?: string;
  serviceAdvisorId?: string;
  assignedBay?: string;
  assignedTechnicians?: string[];
}

export class ServiceAppointmentService {
  /**
   * Create a new service appointment
   */
  static async createAppointment(
    data: CreateAppointmentData
  ): Promise<ServiceAppointment> {
    const supabase = getPrimaryClient();

    // Generate appointment number
    const { data: appointmentNumber } = await supabase
      .rpc('generate_appointment_number', { p_tenant_id: data.tenantId });

    if (!appointmentNumber) {
      throw new Error('Failed to generate appointment number');
    }

    const appointmentDate = data.appointmentDate.toISOString().split('T')[0];
    const scheduledDate = `${appointmentDate}T${data.appointmentTime}:00+07:00`;
    const { data: vehicle, error: vehicleError } = await supabase
      .from('auto_vehicles')
      .select('vin, chassis_number, color_exterior')
      .eq('id', data.vehicleId)
      .eq('tenant_id', data.tenantId)
      .single();

    if (vehicleError) {
      throw new Error(`Failed to load appointment vehicle: ${vehicleError.message}`);
    }

    const vehicleInfo = [
      vehicle.vin,
      vehicle.chassis_number,
      vehicle.color_exterior,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' - ');

    // Create appointment
    const appointmentData: ServiceAppointmentInsert = {
      tenant_id: data.tenantId,
      appointment_number: appointmentNumber,
      customer_id: data.customerId,
      vehicle_id: data.vehicleId,
      appointment_date: appointmentDate,
      appointment_time: data.appointmentTime,
      scheduled_date: scheduledDate,
      vehicle_info: vehicleInfo,
      service_type: data.serviceType,
      requested_services: data.requestedServices,
      service_package_id: data.servicePackageId,
      current_mileage: data.currentMileage,
      reported_issues: data.reportedIssues,
      estimated_duration_minutes: data.estimatedDuration || 60,
      status: 'scheduled',
    };

    const { data: appointment, error } = await supabase
      .from('auto_service_appointments')
      .insert(appointmentData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create appointment: ${error.message}`);
    }

    // Schedule reminder (would be handled by background job in production)
    await this.scheduleReminder(appointment);

    return appointment;
  }

  /**
   * Confirm appointment
   */
  static async confirmAppointment(
    appointmentId: string,
    tenantId: string,
    confirmedBy?: string
  ): Promise<ServiceAppointment> {
    const supabase = getPrimaryClient();

    const { data: appointment, error } = await supabase
      .from('auto_service_appointments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        updated_by: confirmedBy,
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to confirm appointment: ${error.message}`);
    }

    return appointment;
  }

  /**
   * Check-in customer (vehicle arrival)
   */
  static async checkInAppointment(
    appointmentId: string,
    tenantId: string,
    data: {
      serviceAdvisorId?: string;
      assignedBay?: string;
      actualMileage?: number;
      vehicleConditionNotes?: string;
    }
  ): Promise<ServiceAppointment> {
    const supabase = getPrimaryClient();

    const updateData: ServiceAppointmentUpdate = {
      status: 'checked_in',
      checked_in_at: new Date().toISOString(),
      service_advisor_id: data.serviceAdvisorId,
      assigned_bay: data.assignedBay,
    };

    if (data.actualMileage) {
      updateData.current_mileage = data.actualMileage;
    }

    if (data.vehicleConditionNotes) {
      updateData.internal_notes = data.vehicleConditionNotes;
    }

    const { data: appointment, error } = await supabase
      .from('auto_service_appointments')
      .update(updateData)
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to check-in appointment: ${error.message}`);
    }

    return appointment;
  }

  /**
   * Start work on appointment
   */
  static async startWork(
    appointmentId: string,
    tenantId: string,
    technicianIds: string[]
  ): Promise<ServiceAppointment> {
    const supabase = getPrimaryClient();

    const { data: appointment, error } = await supabase
      .from('auto_service_appointments')
      .update({
        status: 'in_progress',
        work_started_at: new Date().toISOString(),
        assigned_technicians: technicianIds,
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to start work: ${error.message}`);
    }

    return appointment;
  }

  /**
   * Complete appointment
   */
  static async completeAppointment(
    appointmentId: string,
    tenantId: string,
    data: {
      finalCost: number;
      workNotes?: string;
    }
  ): Promise<ServiceAppointment> {
    const supabase = getPrimaryClient();

    const { data: appointment, error } = await supabase
      .from('auto_service_appointments')
      .update({
        status: 'completed',
        work_completed_at: new Date().toISOString(),
        final_cost: data.finalCost,
        internal_notes: data.workNotes,
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to complete appointment: ${error.message}`);
    }

    // Trigger NPS survey (Phase 5 integration)
    await this.triggerPostServiceSurvey(appointment);

    return appointment;
  }

  /**
   * Deliver vehicle to customer
   */
  static async deliverVehicle(
    appointmentId: string,
    tenantId: string
  ): Promise<ServiceAppointment> {
    const supabase = getPrimaryClient();

    const { data: appointment, error } = await supabase
      .from('auto_service_appointments')
      .update({
        vehicle_delivered_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to deliver vehicle: ${error.message}`);
    }

    return appointment;
  }

  /**
   * Cancel appointment
   */
  static async cancelAppointment(
    appointmentId: string,
    tenantId: string,
    reason: string,
    cancelledBy?: string
  ): Promise<ServiceAppointment> {
    const supabase = getPrimaryClient();

    const { data: appointment, error } = await supabase
      .from('auto_service_appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        updated_by: cancelledBy,
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel appointment: ${error.message}`);
    }

    return appointment;
  }

  /**
   * Reschedule appointment
   */
  static async rescheduleAppointment(
    appointmentId: string,
    tenantId: string,
    newDate: Date,
    newTime: string,
    reason?: string
  ): Promise<ServiceAppointment> {
    const supabase = getPrimaryClient();

    const { data: appointment, error } = await supabase
      .from('auto_service_appointments')
      .update({
        appointment_date: newDate.toISOString().split('T')[0],
        appointment_time: newTime,
        internal_notes: reason || 'Rescheduled',
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reschedule appointment: ${error.message}`);
    }

    return appointment;
  }

  /**
   * Mark as no-show
   */
  static async markNoShow(
    appointmentId: string,
    tenantId: string
  ): Promise<ServiceAppointment> {
    const supabase = getPrimaryClient();

    const { data: appointment, error } = await supabase
      .from('auto_service_appointments')
      .update({
        status: 'no_show',
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark no-show: ${error.message}`);
    }

    return appointment;
  }

  /**
   * Get appointments for a date range
   */
  static async getAppointmentsByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    filters?: {
      status?: string;
      serviceAdvisorId?: string;
      bay?: string;
    }
  ): Promise<ServiceAppointment[]> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_service_appointments')
      .select('*, customers(*), auto_vehicles(*)')
      .eq('tenant_id', tenantId)
      .gte('appointment_date', startDate.toISOString().split('T')[0])
      .lte('appointment_date', endDate.toISOString().split('T')[0])
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.serviceAdvisorId) {
      query = query.eq('service_advisor_id', filters.serviceAdvisorId);
    }

    if (filters?.bay) {
      query = query.eq('assigned_bay', filters.bay);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get appointments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get today's appointments
   */
  static async getTodayAppointments(
    tenantId: string,
    status?: string
  ): Promise<ServiceAppointment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getAppointmentsByDateRange(tenantId, today, tomorrow, { status });
  }

  /**
   * Get upcoming appointments for a customer
   */
  static async getCustomerUpcomingAppointments(
    tenantId: string,
    customerId: string
  ): Promise<ServiceAppointment[]> {
    const supabase = getPrimaryClient();

    const { data, error } = await supabase
      .from('auto_service_appointments')
      .select('*, auto_vehicles(*)')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .gte('appointment_date', new Date().toISOString().split('T')[0])
      .in('status', ['scheduled', 'confirmed'])
      .order('appointment_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get customer appointments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get vehicle service history
   */
  static async getVehicleAppointments(
    tenantId: string,
    vehicleId: string,
    limit?: number
  ): Promise<ServiceAppointment[]> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_service_appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', vehicleId)
      .order('appointment_date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get vehicle appointments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Check availability for a time slot
   */
  static async checkAvailability(
    tenantId: string,
    date: Date,
    time: string,
    duration: number = 60,
    bay?: string
  ): Promise<{
    available: boolean;
    conflictingAppointments: ServiceAppointment[];
  }> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_service_appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('appointment_date', date.toISOString().split('T')[0])
      .in('status', ['scheduled', 'confirmed', 'checked_in', 'in_progress']);

    if (bay) {
      query = query.eq('assigned_bay', bay);
    }

    const { data: appointments, error } = await query;

    if (error) {
      throw new Error(`Failed to check availability: ${error.message}`);
    }

    if (!appointments || appointments.length === 0) {
      return { available: true, conflictingAppointments: [] };
    }

    // Convert time to minutes for comparison
    const [reqHours, reqMinutes] = time.split(':').map(Number);
    const requestedStart = reqHours * 60 + reqMinutes;
    const requestedEnd = requestedStart + duration;

    const conflicts: ServiceAppointment[] = [];

    for (const appt of appointments) {
      const [apptHours, apptMinutes] = appt.appointment_time.split(':').map(Number);
      const apptStart = apptHours * 60 + apptMinutes;
      const apptEnd = apptStart + (appt.estimated_duration_minutes || 60);

      // Check for overlap
      if (requestedStart < apptEnd && requestedEnd > apptStart) {
        conflicts.push(appt);
      }
    }

    return {
      available: conflicts.length === 0,
      conflictingAppointments: conflicts,
    };
  }

  /**
   * Send appointment reminder
   */
  private static async scheduleReminder(
    appointment: ServiceAppointment
  ): Promise<void> {
    // In production, this would integrate with notification service
    // For now, just mark as pending
    console.log(`[Service] Reminder scheduled for appointment ${appointment.appointment_number}`);
  }

  /**
   * Send reminder to customer
   */
  static async sendReminder(
    appointmentId: string,
    tenantId: string
  ): Promise<void> {
    const supabase = getPrimaryClient();

    // Get appointment with customer details
    const { data: appointment } = await supabase
      .from('auto_service_appointments')
      .select('*, customers(*)')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .single();

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // TODO: Integrate with SMS/Email service
    console.log(`[Service] Sending reminder to ${getCustomerDisplayName(appointment.customers)}`);

    // Mark reminder as sent
    await supabase
      .from('auto_service_appointments')
      .update({
        reminder_sent: true,
        reminder_sent_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);
  }

  /**
   * Trigger post-service survey (Phase 5 integration)
   */
  private static async triggerPostServiceSurvey(
    appointment: ServiceAppointment
  ): Promise<void> {
    // This would integrate with NPSSurveyService from Phase 5
    console.log(`[Service] Triggering post-service survey for ${appointment.appointment_number}`);
    
    // Example integration:
    // await NPSSurveyService.createAutoSurvey({
    //   tenantId: appointment.tenant_id,
    //   customerId: appointment.customer_id,
    //   vehicleId: appointment.vehicle_id,
    //   serviceAppointmentId: appointment.id,
    //   triggerEvent: 'service_completed',
    // });
  }

  /**
   * Get appointment statistics
   */
  static async getAppointmentStats(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    completionRate: number;
    noShowRate: number;
    averageDuration: number;
  }> {
    const supabase = getPrimaryClient();

    const { data: appointments, error } = await supabase
      .from('auto_service_appointments')
      .select('status, work_started_at, work_completed_at')
      .eq('tenant_id', tenantId)
      .gte('appointment_date', startDate.toISOString().split('T')[0])
      .lte('appointment_date', endDate.toISOString().split('T')[0]);

    if (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }

    if (!appointments || appointments.length === 0) {
      return {
        total: 0,
        byStatus: {},
        completionRate: 0,
        noShowRate: 0,
        averageDuration: 0,
      };
    }

    const total = appointments.length;
    const byStatus: Record<string, number> = {};
    let totalDuration = 0;
    let completedCount = 0;

    for (const appt of appointments) {
      if (appt.status) {
        byStatus[appt.status] = (byStatus[appt.status] || 0) + 1;
      }

      if (appt.status === 'completed' && appt.work_started_at && appt.work_completed_at) {
        completedCount++;
        const duration = new Date(appt.work_completed_at).getTime() - 
                        new Date(appt.work_started_at).getTime();
        totalDuration += duration;
      }
    }

    const completionRate = (byStatus['completed'] || 0) / total;
    const noShowRate = (byStatus['no_show'] || 0) / total;
    const averageDuration = completedCount > 0 ? totalDuration / completedCount / (1000 * 60) : 0;

    return {
      total,
      byStatus,
      completionRate: Math.round(completionRate * 100) / 100,
      noShowRate: Math.round(noShowRate * 100) / 100,
      averageDuration: Math.round(averageDuration),
    };
  }
}
