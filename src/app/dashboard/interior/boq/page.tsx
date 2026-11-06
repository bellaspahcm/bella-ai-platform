'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Plus,
  Coins,
  ArrowRight,
  Layers,
  Cpu,
  Boxes,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  X,
  Factory,
} from 'lucide-react';

interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  clientName: string;
}

interface BOQItemDisplay {
  id: string;
  itemCode: string;
  roomName: string;
  itemName: string;
  dimensions: string;
  specifications: string;
  unit: string;
  quantity: number;
  internalUnitCost: number;
  internalTotalCost: number;
  clientUnitPrice: number;
  clientTotalPrice: number;
  grossMarginPercent: number;
}

interface BOMMaterialItem {
  id: string;
  category: 'wood' | 'stone' | 'hardware' | 'finish_aux';
  categoryLabel: string;
  materialCode: string;
  materialName: string;
  spec: string;
  unit: string;
  requiredQuantity: number;
  wasteFactorPercent: number; // Tỷ lệ hao hụt dự kiến (%)
  totalAllocated: number;
  stockStatus: 'in_stock' | 'allocated' | 'order_needed';
}

const DEFAULT_BOM_MATERIALS: BOMMaterialItem[] = [
  {
    id: 'bom-01',
    category: 'wood',
    categoryLabel: 'Gỗ & Ván Công Nghiệp',
    materialCode: 'MFC-MS-440-EV',
    materialName: 'Ván MDF chống ẩm phủ Melamine An Cường',
    spec: 'Khổ 1220 x 2440 x 17 mm lõi xanh',
    unit: 'tấm',
    requiredQuantity: 28,
    wasteFactorPercent: 8,
    totalAllocated: 30,
    stockStatus: 'in_stock',
  },
  {
    id: 'bom-02',
    category: 'wood',
    categoryLabel: 'Gỗ & Ván Công Nghiệp',
    materialCode: 'PLY-VEN-WALNUT',
    materialName: 'Plywood phủ Veneer Óc Chó Bắc Mỹ',
    spec: 'Khổ 1220 x 2440 x 18 mm tuyển vân bông',
    unit: 'tấm',
    requiredQuantity: 15,
    wasteFactorPercent: 10,
    totalAllocated: 17,
    stockStatus: 'allocated',
  },
  {
    id: 'bom-03',
    category: 'stone',
    categoryLabel: 'Đá & Bề Mặt',
    materialCode: 'VICO-BQ8628',
    materialName: 'Đá Thạch Anh Nhân Tạo Vicostone Nero Marquina',
    spec: 'Tấm Jumbo 3300 x 1650 x 20 mm vát mòi 45 độ',
    unit: 'm²',
    requiredQuantity: 12.5,
    wasteFactorPercent: 12,
    totalAllocated: 14.0,
    stockStatus: 'in_stock',
  },
  {
    id: 'bom-04',
    category: 'hardware',
    categoryLabel: 'Phụ Kiện Ngũ Kim',
    materialCode: 'BLUM-CLIP-110',
    materialName: 'Bản lề Blum Clip Top BLUMOTION 110°',
    spec: 'Thép mạ niken tích hợp giảm chấn đóng êm',
    unit: 'cái',
    requiredQuantity: 48,
    wasteFactorPercent: 2,
    totalAllocated: 50,
    stockStatus: 'in_stock',
  },
  {
    id: 'bom-05',
    category: 'hardware',
    categoryLabel: 'Phụ Kiện Ngũ Kim',
    materialCode: 'BLUM-LEGRA-500',
    materialName: 'Ray hộp Blum LEGRABOX Tip-on Blumotion',
    spec: 'Chiều dài 500mm tải trọng 40kg mờ inox',
    unit: 'bộ',
    requiredQuantity: 12,
    wasteFactorPercent: 0,
    totalAllocated: 12,
    stockStatus: 'allocated',
  },
  {
    id: 'bom-06',
    category: 'finish_aux',
    categoryLabel: 'Sơn & Vật Tư Phụ',
    materialCode: 'INCHEM-PU-50',
    materialName: 'Hệ sơn PU Inchem Mỹ mờ 50%',
    spec: 'Sơn lót + Sơn bóng mờ + Chất cứng đóng rắn',
    unit: 'kg',
    requiredQuantity: 35,
    wasteFactorPercent: 15,
    totalAllocated: 40,
    stockStatus: 'in_stock',
  },
  {
    id: 'bom-07',
    category: 'finish_aux',
    categoryLabel: 'Sơn & Vật Tư Phụ',
    materialCode: 'PVC-EDGE-440',
    materialName: 'Chỉ nẹp PVC đồng màu Melamine MS 440',
    spec: 'Quy cách 21 x 1 mm dán cạnh PUR chịu nước',
    unit: 'mét',
    requiredQuantity: 320,
    wasteFactorPercent: 10,
    totalAllocated: 350,
    stockStatus: 'order_needed',
  },
];

export default function InteriorBOQPage() {
  const [activeTab, setActiveTab] = useState<'boq' | 'bom'>('boq');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [items, setItems] = useState<BOQItemDisplay[]>([]);
  const [bomItems, setBOMItems] = useState<BOMMaterialItem[]>(DEFAULT_BOM_MATERIALS);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Item Modal
  const [showNewItemModal, setShowNewItemModal] = useState<boolean>(false);
  const [newItemRoom, setNewItemRoom] = useState('Phòng Khách Luxury');
  const [newItemName, setNewItemName] = useState('');
  const [newItemDim, setNewItemDim] = useState('2400x600x850 mm');
  const [newItemSpec, setNewItemSpec] = useState('MDF chống ẩm An Cường + Sơn PU');
  const [newItemUnit, setNewItemUnit] = useState('bộ');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemCost, setNewItemCost] = useState('25000000');
  const [newItemPrice, setNewItemPrice] = useState('42000000');

  // Load Projects
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/interior/projects');
      const json = await res.json();
      if (json.success && json.data?.projects) {
        setProjects(json.data.projects);
        if (json.data.projects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(json.data.projects[0].id);
        }
      }
    } catch {
      // fallback
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load BOQ items for project
  const loadBOQ = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/interior/boq?projectId=${encodeURIComponent(projId)}`);
      const json = await res.json();
      if (json.success && json.data?.boqs && json.data.boqs.length > 0) {
        const boq = json.data.boqs[0];
        const mappedItems: BOQItemDisplay[] = boq.items.map((i: any) => ({
          id: i.id,
          itemCode: i.itemCode || 'BOQ-ITEM',
          roomName: i.roomName || 'Không gian chính',
          itemName: i.itemName || i.description,
          dimensions: i.dimensions || '2000x600x800 mm',
          specifications: i.specifications || 'Tiêu chuẩn xưởng nội thất',
          unit: i.unit || 'bộ',
          quantity: i.quantity || 1,
          internalUnitCost: i.internalUnitCost || i.unitCostInternal || 0,
          internalTotalCost: i.internalTotalCost || i.totalCostInternal || (i.quantity * (i.internalUnitCost || i.unitCostInternal || 0)),
          clientUnitPrice: i.clientUnitPrice || i.unitPriceClient || 0,
          clientTotalPrice: i.clientTotalPrice || i.totalPriceClient || (i.quantity * (i.clientUnitPrice || i.unitPriceClient || 0)),
          grossMarginPercent: i.grossMarginPercent || 35,
        }));
        setItems(mappedItems);
      } else {
        // Fallback default sample items if no BOQ exists yet
        setItems([
          {
            id: 'boq-1',
            itemCode: 'LIV-PANEL-01',
            roomName: 'Phòng Khách Luxury',
            itemName: 'Hệ vách ốp nan gỗ óc chó kết hợp đá Marble',
            dimensions: '6000x150x3200 mm',
            specifications: 'Khung sắt + Plywood + Nan gỗ óc chó tự nhiên sơn bóng mờ 50%',
            unit: 'bộ',
            quantity: 1,
            internalUnitCost: 120000000,
            internalTotalCost: 120000000,
            clientUnitPrice: 195000000,
            clientTotalPrice: 195000000,
            grossMarginPercent: 38.5,
          },
          {
            id: 'boq-2',
            itemCode: 'KIT-ISLAND-01',
            roomName: 'Bếp Đảo Master',
            itemName: 'Bàn đảo bếp mặt đá Vicostone và tủ rượu cánh kính',
            dimensions: '3200x1100x880 mm',
            specifications: 'MDF lõi xanh An Cường + Mặt đá Vicostone BQ8628 + Ray Blum Legrabox',
            unit: 'bộ',
            quantity: 1,
            internalUnitCost: 95000000,
            internalTotalCost: 95000000,
            clientUnitPrice: 165000000,
            clientTotalPrice: 165000000,
            grossMarginPercent: 42.4,
          },
          {
            id: 'boq-3',
            itemCode: 'MAS-BED-01',
            roomName: 'Phòng Ngủ Master',
            itemName: 'Giường ngủ 2mx2m2 bọc da bò Ý cao cấp',
            dimensions: '2000x2200x1100 mm',
            specifications: 'Khung gỗ sồi tự nhiên + Da bò Mastrotto nhập khẩu Ý + Đệm mút D40',
            unit: 'cái',
            quantity: 1,
            internalUnitCost: 35000000,
            internalTotalCost: 35000000,
            clientUnitPrice: 58000000,
            clientTotalPrice: 58000000,
            grossMarginPercent: 39.7,
          },
        ]);
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể kết nối máy chủ để lấy dữ liệu BOQ.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadBOQ(selectedProjectId);
    }
  }, [selectedProjectId, loadBOQ]);

  // Tripartite Costing calculations
  const totalInternalCost = items.reduce((acc, i) => acc + i.internalTotalCost, 0);
  const totalClientPrice = items.reduce((acc, i) => acc + i.clientTotalPrice, 0);
  const totalGrossMargin = totalClientPrice - totalInternalCost;
  const overallMarginPercent = totalClientPrice > 0 ? ((totalGrossMargin / totalClientPrice) * 100).toFixed(1) : '0';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
  };

  // Add Item to BOQ
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập tên cấu kiện.' });
      return;
    }

    const qty = parseFloat(newItemQty) || 1;
    const unitCost = parseFloat(newItemCost) || 0;
    const unitPrice = parseFloat(newItemPrice) || 0;
    const totalCost = qty * unitCost;
    const totalPrice = qty * unitPrice;
    const margin = totalPrice > 0 ? Math.round(((totalPrice - totalCost) / totalPrice) * 1000) / 10 : 0;

    const newItem: BOQItemDisplay = {
      id: `boq-${Date.now()}`,
      itemCode: `ITEM-${items.length + 1}`,
      roomName: newItemRoom,
      itemName: newItemName,
      dimensions: newItemDim,
      specifications: newItemSpec,
      unit: newItemUnit,
      quantity: qty,
      internalUnitCost: unitCost,
      internalTotalCost: totalCost,
      clientUnitPrice: unitPrice,
      clientTotalPrice: totalPrice,
      grossMarginPercent: margin,
    };

    // Update in local state
    const updated = [...items, newItem];
    setItems(updated);
    setShowNewItemModal(false);
    setNewItemName('');
    setFeedback({ type: 'success', message: `Đã bổ sung cấu kiện "${newItem.itemName}" vào dự toán BOQ!` });

    // Send to API if we have an active approved revision
    try {
      await fetch('/api/interior/boq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          designRevisionId: 'rev-001',
          items: updated.map((i) => ({
            itemCode: i.itemCode,
            roomName: i.roomName,
            itemName: i.itemName,
            description: i.itemName,
            dimensions: i.dimensions,
            specifications: i.specifications,
            unit: i.unit,
            quantity: i.quantity,
            unitCostInternal: i.internalUnitCost,
            unitPriceClient: i.clientUnitPrice,
          })),
        }),
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6 font-sans">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              : 'bg-rose-950/80 text-rose-300 border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/interior"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Dự Toán Thương Mại BOQ & Định Mức Sản Xuất BOM</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Commercial & Costing
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span>Dự án:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-amber-300 rounded px-2 py-0.5 font-medium focus:outline-none focus:border-amber-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadBOQ(selectedProjectId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
            Làm mới
          </button>
          <button
            onClick={() => setShowNewItemModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm cấu kiện BOQ
          </button>
          <Link
            href="/dashboard/interior/contracts"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
          >
            Tạo Báo Giá & Hợp Đồng
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Tabs: BOQ vs BOM (Architectural Boundary Separation) */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('boq')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'boq'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>Bóc Tách Dự Toán Thương Mại (BOQ)</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{items.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('bom')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'bom'
              ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Boxes className="h-4 w-4" />
          <span>Định Mức Vật Tư Kỹ Thuật Sản Xuất (BOM)</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{bomItems.length}</span>
        </button>
      </div>

      {activeTab === 'boq' ? (
        <>
          {/* Tripartite Costing Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold uppercase text-slate-400">1. Tổng Giá Vốn Nội Bộ (COGS)</span>
              <div className="text-xl font-bold font-mono text-slate-200 mt-1">{formatCurrency(totalInternalCost)}</div>
              <p className="text-xs text-slate-400 mt-1">Ván gỗ + Đá thạch anh + Ngũ kim Blum + Công thợ xưởng</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold uppercase text-slate-400">2. Tổng Giá Bán Khách Hàng</span>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">{formatCurrency(totalClientPrice)}</div>
              <p className="text-xs text-slate-400 mt-1">Đơn giá niêm yết theo cấu kiện & định mức</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-emerald-900/40 bg-emerald-950/20">
              <span className="text-xs font-semibold uppercase text-emerald-400">3. Lợi Nhuận Gộp Dự Kiến</span>
              <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
                {formatCurrency(totalGrossMargin)} ({overallMarginPercent}%)
              </div>
              <p className="text-xs text-emerald-400/80 mt-1">Tỷ suất lợi nhuận gộp toàn bộ dự án</p>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-amber-400" />
                Danh Mục Cấu Kiện & Tripartite Costing
              </h3>
              <span className="text-xs text-slate-400 font-mono">{items.length} hạng mục</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase text-slate-400 border-b border-slate-800 font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Khu vực & Hạng mục</th>
                    <th className="py-3 px-4">Quy cách & Kích thước</th>
                    <th className="py-3 px-4">ĐVT</th>
                    <th className="py-3 px-4 text-center">SL</th>
                    <th className="py-3 px-4 text-right">Đơn giá vốn</th>
                    <th className="py-3 px-4 text-right">Giá vốn tổng</th>
                    <th className="py-3 px-4 text-right">Đơn giá khách</th>
                    <th className="py-3 px-4 text-right">Thành tiền khách</th>
                    <th className="py-3 px-4 text-right">Lợi nhuận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">{item.itemName}</div>
                        <div className="text-[11px] text-amber-500 font-mono mt-0.5">
                          {item.roomName} • {item.itemCode}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-mono text-slate-300">{item.dimensions}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{item.specifications}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">{item.unit}</td>
                      <td className="py-3.5 px-4 text-center font-mono">{item.quantity}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        {formatCurrency(item.internalUnitCost)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {formatCurrency(item.internalTotalCost)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-amber-400/90">
                        {formatCurrency(item.clientUnitPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-amber-300">
                        {formatCurrency(item.clientTotalPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-medium">
                        {item.grossMarginPercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* BOM Production Tab */
        <div className="space-y-4">
          {/* Architectural Callout Banner */}
          <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800/50 flex items-start gap-3">
            <Factory className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-blue-200">
                Định Mức Vật Tư Sản Xuất (BOM) — Tách Biệt Khỏi Báo Giá Khách Hàng (BOQ)
              </div>
              <p className="text-blue-300/80 leading-relaxed">
                BOM là căn cứ kỹ thuật để cấp phát nguyên vật liệu từ kho tới xưởng đóng module. Phân tách rõ ràng giữa
                giá chào bán khách hàng (BOQ) và định mức tiêu hao thực tế (BOM bao gồm hệ số hao hụt waste factor).
              </p>
            </div>
          </div>

          {/* BOM Itemized Table */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Boxes className="h-4 w-4 text-blue-400" />
                Danh Mục Vật Tư Cần Cấp Phát Cho Xưởng Sản Xuất
              </h3>
              <Link
                href="/dashboard/interior/production"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium transition-colors"
              >
                Chuyển lệnh sang Manufacturing OS
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase text-slate-400 border-b border-slate-800 font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Nhóm & Tên Vật Tư</th>
                    <th className="py-3 px-4">Mã Vật Tư / Quy Cách</th>
                    <th className="py-3 px-4">ĐVT</th>
                    <th className="py-3 px-4 text-center">Định mức thuần</th>
                    <th className="py-3 px-4 text-center">Hao hụt (%)</th>
                    <th className="py-3 px-4 text-center font-bold text-amber-300">Tổng xuất kho</th>
                    <th className="py-3 px-4 text-center">Trạng thái kho</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {bomItems.map((bom) => (
                    <tr key={bom.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">{bom.materialName}</div>
                        <div className="text-[11px] text-blue-400 font-mono mt-0.5">{bom.categoryLabel}</div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-mono text-amber-400">{bom.materialCode}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{bom.spec}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">{bom.unit}</td>
                      <td className="py-3.5 px-4 text-center font-mono">{bom.requiredQuantity}</td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400">+{bom.wasteFactorPercent}%</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-300">
                        {bom.totalAllocated} {bom.unit}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {bom.stockStatus === 'in_stock' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Đủ trong kho
                          </span>
                        ) : bom.stockStatus === 'allocated' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Đã gán lệnh
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Cần đặt mua
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add BOQ Item */}
      {showNewItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-400" /> Bổ Sung Cấu Kiện Vào Dự Toán BOQ
              </h3>
              <button onClick={() => setShowNewItemModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Khu vực / Phòng *</label>
                  <input
                    type="text"
                    required
                    value={newItemRoom}
                    onChange={(e) => setNewItemRoom(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Đơn vị tính *</label>
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="bộ">bộ</option>
                    <option value="cái">cái</option>
                    <option value="md">md (mét dài)</option>
                    <option value="m2">m² (mét vuông)</option>
                    <option value="gói">gói</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Tên cấu kiện nội thất *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Tủ quần áo kịch trần 4 cánh mở"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Kích thước (DxRxC)</label>
                  <input
                    type="text"
                    value={newItemDim}
                    onChange={(e) => setNewItemDim(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Số lượng *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Quy cách kỹ thuật / Vật liệu</label>
                <input
                  type="text"
                  value={newItemSpec}
                  onChange={(e) => setNewItemSpec(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Đơn giá vốn nội bộ (COGS)</label>
                  <input
                    type="number"
                    value={newItemCost}
                    onChange={(e) => setNewItemCost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Đơn giá bán khách hàng</label>
                  <input
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewItemModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm"
                >
                  Thêm vào BOQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
