'use client';

import { useState, useEffect, useCallback } from 'react';
import { ServiceCalendar } from '@/modules/bella-auto/components/workshop/ServiceCalendar';
import { RepairOrderBoard } from '@/modules/bella-auto/components/workshop/RepairOrderBoard';
import { AppointmentDetailModal, type ServiceAppointment } from '@/modules/bella-auto/components/workshop/AppointmentDetailModal';
import { Wrench, Calendar, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { mapAppointmentForCalendar, mapRepairOrderForBoard } from '@/modules/bella-auto/lib/workshop-mappers';
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type TabType = 'appointments' | 'orders' | 'technicians';
type RepairOrderBoardItem = Parameters<typeof RepairOrderBoard>[0]['orders'][number];

export default function WorkshopPage() {
  const { tenantId } = useTenantContext();
  const [activeTab, setActiveTab] = useState<TabType>('appointments');
  const [appointments, setAppointments] = useState<ServiceAppointment[]>([]);
  const [orders, setOrders] = useState<RepairOrderBoardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<ServiceAppointment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Fetch appointments and repair orders from Supabase
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      
      if (!supabase) {
        console.error('Supabase client not initialized');
        toast.error('Không thể kết nối Supabase');
        setIsLoading(false);
        return;
      }
      
      // Debug: Log current tenant context
      console.log('[Workshop] Fetching data...');
      
      // Check if tables exist with a simple count query first
      const { count: aptCount, error: aptTestError } = await supabase
        .from('auto_service_appointments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId); // ✅ Add tenant filter
      
      if (aptTestError) {
        console.error('[Workshop] Table check failed:', {
          code: aptTestError.code,
          message: aptTestError.message,
          details: aptTestError.details,
          hint: aptTestError.hint
        });
        
        if (aptTestError.code === 'PGRST116' || aptTestError.message?.includes('does not exist')) {
          toast.error('Bảng auto_service_appointments chưa được tạo. Chạy migration: 20260803260000');
          setIsLoading(false);
          return;
        }
      } else {
        console.log(`[Workshop] Found ${aptCount} appointments in database`);
      }
      
      // Query with proper null handling
      const appointmentsRes = await supabase
        .from('auto_service_appointments')
        .select('*')
        .eq('tenant_id', tenantId) // ✅ Add tenant filter
        .order('scheduled_date', { ascending: true });
      
      console.log('[Workshop] Appointments query result:', {
        success: !appointmentsRes.error,
        count: appointmentsRes.data?.length || 0,
        error: appointmentsRes.error ? {
          code: appointmentsRes.error.code,
          message: appointmentsRes.error.message
        } : null
      });
      
      const ordersRes = await supabase
        .from('auto_repair_orders')
        .select('*')
        .eq('tenant_id', tenantId) // ✅ Add tenant filter
        .order('opened_at', { ascending: false });
      
      console.log('[Workshop] Orders query result:', {
        success: !ordersRes.error,
        count: ordersRes.data?.length || 0,
        error: ordersRes.error ? {
          code: ordersRes.error.code,
          message: ordersRes.error.message
        } : null
      });

      if (appointmentsRes.error) {
        console.error('Appointments fetch error:', appointmentsRes.error.message || appointmentsRes.error);
        // Check if table exists
        if (appointmentsRes.error.code === 'PGRST116' || appointmentsRes.error.message?.includes('relation')) {
          toast.error('Bảng auto_service_appointments chưa được tạo. Vui lòng chạy migration.');
        }
        setAppointments([]);
      } else {
        // Map database format to component format
        const mappedAppointments = (appointmentsRes.data || []).map(mapAppointmentForCalendar);
        setAppointments(mappedAppointments);
      }
      
      if (ordersRes.error) {
        console.error('Orders fetch error:', ordersRes.error.message || ordersRes.error);
        // Check if table exists
        if (ordersRes.error.code === 'PGRST116' || ordersRes.error.message?.includes('relation')) {
          toast.error('Bảng auto_repair_orders chưa được tạo. Vui lòng chạy migration.');
        }
        setOrders([]);
      } else {
        // Map database format to component format
        const mappedOrders = (ordersRes.data || []).map(mapRepairOrderForBoard);
        setOrders(mappedOrders);
      }
    } catch (error) {
      console.error('Failed to fetch workshop data:', error);
      toast.error('Không thể tải dữ liệu workshop');
      setAppointments([]);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCheckIn = async (appointmentId: string) => {
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');
      
      const { error } = await supabase
        .from('auto_service_appointments')
        .update({ status: 'checked_in' })
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      toast.success('Đã check-in xe thành công!');
      
      // Update local state for modal immediately
      setSelectedAppointment(prev => prev ? { ...prev, status: 'checked_in' } : null);
      // Reload lists
      fetchData();
    } catch (error) {
      console.error('Check-in failed:', error);
      toast.error('Không thể thực hiện check-in');
    }
  };

  const handleCancel = async (appointmentId: string) => {
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');
      
      const { error } = await supabase
        .from('auto_service_appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      toast.success('Đã hủy lịch hẹn thành công!');
      setIsDetailModalOpen(false);
      setSelectedAppointment(null);
      fetchData();
    } catch (error) {
      console.error('Cancel appointment failed:', error);
      toast.error('Không thể hủy lịch hẹn');
    }
  };

  const handleCreateRepairOrder = async (appointmentId: string) => {
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');
      
      // 1. Get detailed info of this appointment first
      const { data: aptData, error: fetchError } = await supabase
        .from('auto_service_appointments')
        .select('*')
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId)
        .single();
        
      if (fetchError || !aptData) {
        throw new Error(fetchError?.message || 'Không tìm thấy lịch hẹn');
      }

      // Generate a unique RO Number
      const tenantCode = tenantId.replace(/[^a-fA-F0-9]/g, '').toUpperCase().slice(0, 4).padEnd(4, 'X');
      const dateSuffix = aptData.appointment_date ? aptData.appointment_date.replace(/-/g, '').slice(2) : '260805';
      const randHex = Math.floor(Math.random() * 9000 + 1000).toString();
      const roNum = `RO-${tenantCode}-${dateSuffix}-${randHex}`;

      // 2. Create Repair Order
      const { error: roError } = await supabase
        .from('auto_repair_orders')
        .insert({
          tenant_id: tenantId,
          appointment_id: appointmentId,
          customer_id: aptData.customer_id,
          vehicle_id: aptData.vehicle_id,
          order_number: roNum,
          status: 'open',
          order_date: aptData.appointment_date || new Date().toISOString().split('T')[0],
          order_type: 'repair',
          work_description: aptData.description || aptData.requested_services || 'Sửa chữa bảo dưỡng theo lịch hẹn',
          customer_name: aptData.customer_name || 'Unknown Customer',
          customer_phone: aptData.customer_phone,
          vehicle_info: aptData.vehicle_info,
          estimated_labor_cost: 300000,
          estimated_parts_cost: 0,
          estimated_total: 300000
        });

      if (roError) throw roError;

      // 3. Update appointment status to 'in_progress'
      const { error: aptUpdateError } = await supabase
        .from('auto_service_appointments')
        .update({ status: 'in_progress' })
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId);

      if (aptUpdateError) throw aptUpdateError;

      toast.success(`Đã tạo Lệnh Sửa Chữa ${roNum} thành công!`);
      setIsDetailModalOpen(false);
      setSelectedAppointment(null);
      
      // Refresh database records
      await fetchData();
      
      // Auto switch view to 'Bảng Sửa Chữa'
      setActiveTab('orders');
    } catch (error) {
      console.error('Create RO failed:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Không thể tạo Lệnh Sửa Chữa: ${errMsg}`);
    }
  };

  const handleUpdateAppointment = async (
    appointmentId: string,
    updatedData: {
      scheduledDate: string;
      scheduledTime: string;
      description: string;
      estimatedDuration: number;
    }
  ) => {
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');

      // Create scheduled_date string (TIMESTAMPTZ) in Vietnam timezone (+07:00)
      const scheduledDateStr = `${updatedData.scheduledDate}T${updatedData.scheduledTime}:00+07:00`;

      const { error } = await supabase
        .from('auto_service_appointments')
        .update({
          appointment_date: updatedData.scheduledDate,
          appointment_time: updatedData.scheduledTime + ':00',
          scheduled_date: scheduledDateStr,
          description: updatedData.description,
          estimated_duration_hours: updatedData.estimatedDuration,
        })
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      toast.success('Đã cập nhật/dời lịch hẹn thành công!');
      
      // Update local state for modal immediately to prevent UI jumps
      setSelectedAppointment((prev) => 
        prev ? {
          ...prev,
          scheduledDate: updatedData.scheduledDate,
          scheduledTime: updatedData.scheduledTime,
          serviceType: updatedData.description,
          estimatedDuration: updatedData.estimatedDuration,
        } : null
      );

      // Reload database records
      await fetchData();
    } catch (error) {
      console.error('Update appointment failed:', error);
      toast.error('Không thể cập nhật lịch hẹn');
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-900 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/15 dark:from-blue-500/20 dark:to-indigo-500/5 border border-blue-100/50 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">
              Trung Tâm Dịch Vụ &amp; Xưởng
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hệ thống quản lý đặt lịch hẹn, phân bổ phiếu sửa chữa và tối ưu hóa năng suất kỹ thuật viên
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation (Premium Segmented Control Style) */}
      <div className="flex justify-start">
        <nav className="flex p-1.5 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl gap-1.5 shadow-sm">
          <button 
            onClick={() => setActiveTab('appointments')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
              activeTab === 'appointments' 
                ? 'bg-white dark:bg-slate-950 text-cyan-600 dark:text-cyan-400 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/20 dark:border-slate-800/30' 
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
            }`}
          >
            <Calendar className="h-4 w-4 shrink-0" />
            Lịch Hẹn
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
              activeTab === 'orders' 
                ? 'bg-white dark:bg-slate-950 text-cyan-600 dark:text-cyan-400 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/20 dark:border-slate-800/30' 
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
            }`}
          >
            <Wrench className="h-4 w-4 shrink-0" />
            Bảng Sửa Chữa
          </button>
          <button 
            onClick={() => setActiveTab('technicians')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
              activeTab === 'technicians' 
                ? 'bg-white dark:bg-slate-950 text-cyan-600 dark:text-cyan-400 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/20 dark:border-slate-800/30' 
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
            }`}
          >
            <Users className="h-4 w-4 shrink-0" />
            Kỹ Thuật Viên
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="transition-all duration-300">
        {activeTab === 'appointments' && (
          isLoading ? (
            <div className="flex items-center justify-center h-72 bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl">
              <div className="text-center space-y-4">
                <div className="w-10 h-10 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đang tải lịch hẹn...</p>
              </div>
            </div>
          ) : (
            <ServiceCalendar
              appointments={appointments}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onAppointmentClick={(apt) => {
                setSelectedAppointment(apt);
                setIsDetailModalOpen(true);
              }}
            />
          )
        )}

        {activeTab === 'orders' && (
          isLoading ? (
            <div className="flex items-center justify-center h-72 bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl">
              <div className="text-center space-y-4">
                <div className="w-10 h-10 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đang tải đơn sửa chữa...</p>
              </div>
            </div>
          ) : (
            <RepairOrderBoard
              orders={orders}
              onOrderClick={(order) => {
                console.log('Order clicked:', order);
              }}
            />
          )
        )}

        {activeTab === 'technicians' && (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>Dữ liệu kỹ thuật viên chưa sẵn sàng</AlertTitle>
            <AlertDescription>Danh sách và năng suất kỹ thuật viên chưa kết nối dữ liệu vận hành. Chưa thể xác định số lượng kỹ thuật viên hoặc khối lượng công việc.</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Appointment Detail Modal */}
      <AppointmentDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedAppointment(null);
        }}
        appointment={selectedAppointment}
        onCheckIn={handleCheckIn}
        onCreateRepairOrder={handleCreateRepairOrder}
        onCancel={handleCancel}
        onUpdateAppointment={handleUpdateAppointment}
      />
    </div>
  );
}
