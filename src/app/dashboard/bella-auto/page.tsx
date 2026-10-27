import { Suspense } from 'react';
// Automotive vertical terms: Xe, VIN, Hành trình, Báo giá, Showroom, Dịch vụ
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import VehicleInventoryDashboard from '@/components/bella-auto/VehicleInventoryDashboard';
import { BellaAutoHeader } from '@/components/bella-auto/BellaAutoHeader';
import BellaAutoAnalyticsDashboard from '@/components/bella-auto/BellaAutoAnalyticsDashboard';
import { getMobilityVehicleInventorySummary } from '@/platform/mobility/supabase-vehicle-contract';

export const dynamic = 'force-dynamic';

export default async function BellaAutoPage() {
  let profile = null;
  let tenant = null;
  let vehicleStats = {
    total: 0,
    showroom: 0,
    warehouse: 0,
    allocated: 0,
    delivered: 0,
  };
  let monogram = 'BA';
  let errorMsg = null;

  console.log('[BellaAutoPage] Starting render...');
  const supabase = await createClient();

  console.log('[BellaAutoPage] Getting user...');
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log('[BellaAutoPage] No user, redirecting to login');
    redirect('/login');
  }

  console.log('[BellaAutoPage] User authenticated:', user.id);

  try {
    // Get tenant and user profile
    const { data: profileData } = await supabase
      .from('users')
      .select('tenant_id, full_name')
      .eq('id', user.id)
      .single();

    profile = profileData;

    if (!profile?.tenant_id) {
      errorMsg = 'Không tìm thấy tenant';
    } else {
      // Get tenant name
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', profile.tenant_id)
        .single();
      tenant = tenantData;

      const vehicleSummary = await getMobilityVehicleInventorySummary(supabase, {
        tenantId: profile.tenant_id,
      });

      vehicleStats = {
        total: vehicleSummary.totalVehicles,
        showroom: vehicleSummary.byStatus.showroom,
        warehouse: vehicleSummary.byStatus.warehouse,
        allocated: vehicleSummary.byStatus.allocated,
        delivered: vehicleSummary.byStatus.delivered,
      };

      monogram = profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'BA';
    }
  } catch (error) {
    console.error('[BellaAutoPage] Fatal error:', error);
    errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
  }

  if (errorMsg) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600">Lỗi tải Dashboard</h2>
          <p className="text-slate-600">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!profile?.tenant_id) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600">Không tìm thấy Tenant</h2>
          <p className="text-slate-600">Hồ sơ người dùng không liên kết với Tenant nào.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-10 space-y-8">
      {/* Premium Dashboard Welcome Header - Real Estate Style */}
      <BellaAutoHeader 
        monogram={monogram}
        fullName={profile?.full_name || 'Admin'}
        tenantName={tenant?.name || 'Bella Auto'}
      />

      {/* Advanced Analytics - Recharts Interactive Charts */}
      <Suspense fallback={
        <div className="space-y-6 animate-pulse">
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          </div>
        </div>
      }>
        <BellaAutoAnalyticsDashboard key={profile.tenant_id} tenantId={profile.tenant_id} inventory={{
          totalVehicles: vehicleStats.total, showroomCount: vehicleStats.showroom,
          warehouseCount: vehicleStats.warehouse, allocatedCount: vehicleStats.allocated,
          deliveredCount: vehicleStats.delivered,
        }} />
      </Suspense>

      {/* Vehicle Inventory Dashboard */}
      <Suspense fallback={
        <div className="p-8 space-y-6 animate-pulse">
          <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      }>
        <VehicleInventoryDashboard tenantId={profile.tenant_id} />
      </Suspense>
    </div>
  );
}
