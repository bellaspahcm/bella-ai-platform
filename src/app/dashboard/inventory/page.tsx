'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { InventoryAddItemModal } from './components/InventoryAddItemModal';
import { InventoryCreateRequestModal } from './components/InventoryCreateRequestModal';
import { InventoryForecastPanel } from './components/InventoryForecastPanel';
import { InventoryLogsPanel } from './components/InventoryLogsPanel';
import { InventoryPageHeader } from './components/InventoryPageHeader';
import { InventoryReconciliationPanel } from './components/InventoryReconciliationPanel';
import { InventoryRestockModal } from './components/InventoryRestockModal';
import { InventoryStockPanel } from './components/InventoryStockPanel';
import { InventoryTabs } from './components/InventoryTabs';
import { InventoryTransferOrdersPanel } from './components/InventoryTransferOrdersPanel';
import {
  INTERIOR_PRODUCT_KEY,
  isHaircutProductPresentation,
  isInteriorProductPresentation,
} from '@/lib/business-rules/product-presentation-routing';
import { getDefaultTenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { useUser } from '@/lib/user-context';
import { HaircutInventoryView } from './HaircutInventoryView';
import { InteriorInventoryView } from './InteriorInventoryView';
import { useInventoryPageState } from './hooks/useInventoryPageState';
import { useInventoryForecast } from './hooks/useInventoryForecast';
import { ProductSalesListPage } from '@/components/product-sales/ProductSalesListPage';

function StandardInventoryPage() {
  const {
    activeTab,
    setActiveTab,
    items,
    loading,
    search,
    setSearch,
    stockFilter,
    setStockFilter,
    orders,
    loadingOrders,
    showCreateRequest,
    setShowCreateRequest,
    requestCart,
    setRequestCart,
    selectedItemIndex,
    setSelectedItemIndex,
    requestQty,
    setRequestQty,
    requestNotes,
    setRequestNotes,
    submittingOrder,
    processingOrderId,
    logMonth,
    setLogMonth,
    logYear,
    setLogYear,
    restockTarget,
    setRestockTarget,
    restockAmt,
    setRestockAmt,
    submitting,
    showAdd,
    setShowAdd,
    newItem,
    setNewItem,
    reconMonth,
    setReconMonth,
    reconYear,
    setReconYear,
    reconRows,
    reconLoading,
    reconSaving,
    filteredItems,
    filteredLogs,
    lowCount,
    handleSaveReconciliation,
    updateReconRow,
    handleRestock,
    handleAddItem,
    addToCart,
    removeFromCart,
    submitTransferOrder,
    handleConfirmReceipt,
    handleCancelOrder,
    refreshPageData,
  } = useInventoryPageState();

  const { product } = useUser();
  const isHaircut = isHaircutProductPresentation(product);

  // ✅ Inventory forecast enabled
  const {
    forecast,
    loading: forecastLoading,
    criticalCount,
    metadata,
    refresh: refreshForecast,
  } = useInventoryForecast(30);
  
  const displayForecast = forecast;
  const displayCriticalCount = criticalCount;

  usePageRefresh(() => {
    void refreshPageData();
    void refreshForecast();
  });

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <RefreshCw className="w-10 h-10 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10 space-y-6 md:space-y-10">

      <InventoryPageHeader 
        totalItems={items.length} 
        lowCount={lowCount}
        forecastCount={displayForecast.length}
        forecastCritical={displayCriticalCount}
        forecastLoading={forecastLoading}
      />

      <InventoryTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'sales' ? (
        // Product Sales tab - full width, no sidebar
        <div className="w-full">
          <ProductSalesListPage />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-10">

        <div className="xl:col-span-2 space-y-6">
          {/* ✅ Inventory forecast panel */}
          {activeTab === 'stock' && displayForecast.length > 0 && (
            <InventoryForecastPanel
              forecast={displayForecast}
              loading={forecastLoading}
              error={null}
              metadata={metadata || {
                totalBookings: 0,
                forecastPeriodDays: 30,
              }}
            />
          )}

          {activeTab === 'stock' ? (
            <InventoryStockPanel
              items={items}
              filteredItems={filteredItems}
              lowCount={lowCount}
              search={search}
              stockFilter={stockFilter}
              setSearch={setSearch}
              setStockFilter={setStockFilter}
              setShowAdd={setShowAdd}
              setRestockTarget={setRestockTarget}
              setRestockAmt={setRestockAmt}
              setRequestCart={setRequestCart}
              setShowCreateRequest={setShowCreateRequest}
            />
          ) : activeTab === 'requests' ? (
            <InventoryTransferOrdersPanel
              orders={orders}
              loadingOrders={loadingOrders}
              processingOrderId={processingOrderId}
              onCreateRequest={() => {
                setRequestCart([]);
                setSelectedItemIndex(-1);
                setRequestQty(0);
                setRequestNotes('');
                setShowCreateRequest(true);
              }}
              onCancelOrder={handleCancelOrder}
              onConfirmReceipt={handleConfirmReceipt}
            />
          ) : (
            <InventoryReconciliationPanel
              reconMonth={reconMonth}
              reconYear={reconYear}
              reconRows={reconRows}
              reconLoading={reconLoading}
              reconSaving={reconSaving}
              setReconMonth={setReconMonth}
              setReconYear={setReconYear}
              updateReconRow={updateReconRow}
              handleSaveReconciliation={handleSaveReconciliation}
            />
          )}
        </div>
        <InventoryLogsPanel
          logs={filteredLogs}
          logMonth={logMonth}
          logYear={logYear}
          setLogMonth={setLogMonth}
          setLogYear={setLogYear}
        />
      </div>
      )}

      <InventoryRestockModal
        target={restockTarget}
        restockAmt={restockAmt}
        submitting={submitting}
        setRestockAmt={setRestockAmt}
        onClose={() => setRestockTarget(null)}
        onSubmit={handleRestock}
      />

      <InventoryCreateRequestModal
        show={showCreateRequest}
        items={items}
        requestCart={requestCart}
        selectedItemIndex={selectedItemIndex}
        requestQty={requestQty}
        requestNotes={requestNotes}
        submittingOrder={submittingOrder}
        setSelectedItemIndex={setSelectedItemIndex}
        setRequestQty={setRequestQty}
        setRequestNotes={setRequestNotes}
        addToCart={addToCart}
        removeFromCart={removeFromCart}
        submitTransferOrder={submitTransferOrder}
        onClose={() => setShowCreateRequest(false)}
      />

      <InventoryAddItemModal
        show={showAdd}
        newItem={newItem}
        submitting={submitting}
        setNewItem={setNewItem}
        onClose={() => setShowAdd(false)}
        onSubmit={handleAddItem}
      />
    </div>
  );
}

function HaircutInventoryViewWrapper() {
  const [showAdd, setShowAdd] = useState(false);
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [restockTarget, setRestockTarget] = useState<unknown>(null);

  return (
    <HaircutInventoryView
      onRestock={() => setShowAdd(true)}
      onAdjust={(item) => setRestockTarget(item)}
      onTransferRequest={() => setShowCreateRequest(true)}
    />
  );
}

export default function InventoryPage() {
  const { product, tenantPresentation, tenantSettings, isLoading } = useUser();
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const isHaircut = isHaircutProductPresentation(product);
  const isInterior =
    isInteriorProductPresentation(product) ||
    tenantPresentation?.product_key === INTERIOR_PRODUCT_KEY ||
    getDefaultTenantModuleKey(tenantSettings?.enabled_modules, tenantSettings?.name) === INTERIOR_PRODUCT_KEY;

  if (isHaircut) {
    return <HaircutInventoryViewWrapper />;
  }

  if (isInterior) {
    return <InteriorInventoryView />;
  }

  return <StandardInventoryPage />;
}
