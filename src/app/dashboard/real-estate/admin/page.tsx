"use client";
import { LandPreviewNotice, unavailableLandAction } from "@/modules/real_estate/components/LandUiControls";

import { useState } from "react";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { motion } from "framer-motion";
import {
  Shield, Settings, History, Webhook, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, Clock,
  Search, Trash2, RotateCcw
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminSection = "permissions" | "config" | "audit-log" | "webhook-dlq";

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  resource: string;
  result: "success" | "failure" | "warning";
  timestamp: string;
  details?: string;
}

interface ConfigItem {
  key: string;
  label: string;
  value: string;
  type: "text" | "number" | "boolean" | "select";
  options?: string[];
  description: string;
}

interface WebhookDLQEntry {
  id: string;
  event: string;
  endpoint: string;
  failedAt: string;
  attempts: number;
  lastError: string;
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_AUDIT: AuditEntry[] = [
  { id: "A001", action: "Cập nhật trạng thái sản phẩm", actor: "Nguyễn Admin", resource: "CH-0042 → deposited", result: "success", timestamp: "2026-08-01T09:05:12Z" },
  { id: "A002", action: "Xoá Lead", actor: "Trần Sale", resource: "Lead ID: L-0019", result: "failure", timestamp: "2026-08-01T08:40:30Z", details: "Permission denied: cannot delete closed_won lead" },
  { id: "A003", action: "Tạo Hợp Đồng HĐMB", actor: "Lê Manager", resource: "HĐMB-2026-007", result: "success", timestamp: "2026-07-31T15:22:00Z" },
  { id: "A004", action: "Thay đổi cấu hình VAT", actor: "Phạm Admin", resource: "config:VAT_RATE", result: "warning", timestamp: "2026-07-31T14:00:00Z", details: "Rate changed from 10% to 8% — requires accountant approval" },
  { id: "A005", action: "Export báo cáo PDF", actor: "Nguyễn Admin", resource: "Report-Tháng7/2026", result: "success", timestamp: "2026-07-31T11:30:00Z" },
  { id: "A006", action: "Kích hoạt webhook Zalo ZNS", actor: "Lê Manager", resource: "webhook:zalo_zns", result: "success", timestamp: "2026-07-30T09:00:00Z" },
];

const MOCK_CONFIG: ConfigItem[] = [
  { key: "VAT_RATE", label: "Thuế VAT (%)", value: "10", type: "number", description: "Mức thuế VAT áp dụng cho hợp đồng mua bán BĐS" },
  { key: "BOOKING_EXPIRY_HOURS", label: "Thời gian giữ chỗ (giờ)", value: "24", type: "number", description: "Số giờ tối đa giữ chỗ trước khi tự động giải phóng" },
  { key: "MAX_CONCURRENT_RESERVATIONS", label: "Số giữ chỗ đồng thời tối đa", value: "3", type: "number", description: "Một khách hàng được giữ chỗ tối đa bao nhiêu căn cùng lúc" },
  { key: "ENABLE_ZALO_ZNS", label: "Bật Zalo ZNS Notifications", value: "true", type: "boolean", description: "Gửi thông báo nhắc nhở qua Zalo ZNS cho khách hàng" },
  { key: "DEFAULT_PAYMENT_SCHEDULE", label: "Tiến độ thanh toán mặc định", value: "30-40-30", type: "select", options: ["30-40-30", "20-30-50", "50-30-20"], description: "Phân bổ % thanh toán theo tiến độ: đặt cọc / ký HĐ / bàn giao" },
  { key: "ENABLE_AI_COPILOT", label: "Bật AI Copilot BĐS", value: "true", type: "boolean", description: "Kích hoạt RealEstateExecutiveSkill trên AI Orchestrator" },
];

const MOCK_DLQ: WebhookDLQEntry[] = [
  { id: "DLQ-001", event: "contract.signed", endpoint: "https://crm.example.com/webhook/re-events", failedAt: "2026-08-01T07:15:00Z", attempts: 3, lastError: "Connection timeout after 30s" },
  { id: "DLQ-002", event: "payment.received", endpoint: "https://accounting.example.com/hooks/payment", failedAt: "2026-07-31T22:00:00Z", attempts: 5, lastError: "HTTP 502 Bad Gateway" },
];

const PERMISSION_MATRIX = [
  { role: "Super Admin",    permissions: ["Tất cả quyền", "Quản lý tenant", "Cấu hình hệ thống", "Xoá dữ liệu"] },
  { role: "Giám Đốc KD",   permissions: ["Xem báo cáo tất cả", "Phê duyệt HĐMB", "Quản lý leads", "Phê duyệt đặt cọc"] },
  { role: "Kế Toán Trưởng",permissions: ["Xem tài chính", "Tạo phiếu thu", "Chỉnh sửa lịch thanh toán", "Xuất báo cáo"] },
  { role: "Sale Agent",     permissions: ["Tạo lead", "Xem bảng hàng", "Đặt giữ chỗ", "Cập nhật CRM"] },
  { role: "Môi Giới",       permissions: ["Xem bảng hàng", "Đặt giữ chỗ (hạn chế)", "Xem commission"] },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function ResultBadge({ result }: { result: AuditEntry["result"] }) {
  const cfg = {
    success: { icon: CheckCircle2, color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30" },
    failure: { icon: XCircle,      color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30" },
    warning: { icon: AlertTriangle,color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30" },
  }[result];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {result === "success" ? "Thành công" : result === "failure" ? "Thất bại" : "Cảnh báo"}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [section, setSection] = useState<AdminSection>("permissions");
  const [auditSearch, setAuditSearch] = useState("");
  const [configs, setConfigs] = useState(MOCK_CONFIG);

  const filteredAudit = MOCK_AUDIT.filter(e =>
    e.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
    e.actor.toLowerCase().includes(auditSearch.toLowerCase()) ||
    e.resource.toLowerCase().includes(auditSearch.toLowerCase())
  );

  const updateConfig = (_key: string, _val: string) => { unavailableLandAction("Lưu cấu hình quản trị"); };

  const SECTIONS: { id: AdminSection; label: string; icon: React.ElementType }[] = [
    { id: "permissions",  label: "Ma Trận Phân Quyền", icon: Shield },
    { id: "config",       label: "Config Center",       icon: Settings },
    { id: "audit-log",    label: "Nhật Ký Hệ Thống",   icon: History },
    { id: "webhook-dlq",  label: "Webhook DLQ",         icon: Webhook },
  ];

  return (
    <div className="space-y-8">
      <LandPreviewNotice />
      {/* ─ Header ─ */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Shield className="w-6 h-6 text-slate-600 dark:text-slate-300" />
          </div>
          Quản Trị Hệ Thống
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Phân quyền, cấu hình, nhật ký và webhook</p>
      </div>

      {/* ─ Section Tabs ─ */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(s => {
          const Icon = s.icon;
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                active
                  ? "bg-amber-100 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <Icon className="w-4 h-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ─── Permissions Matrix ─── */}
      {section === "permissions" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Ma trận phân quyền theo vai trò trong hệ thống Real Estate ERP</p>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-800">
                <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3.5 font-semibold">Vai Trò</th>
                  <th className="text-left px-5 py-3.5 font-semibold">Quyền Hạn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {PERMISSION_MATRIX.map((row, i) => (
                  <motion.tr
                    key={row.role}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                        <span className="text-slate-900 dark:text-white font-bold">{row.role}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {row.permissions.map(p => (
                          <span key={p} className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-0.5 text-slate-700 dark:text-slate-300">
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ─── Config Center ─── */}
      {section === "config" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Cấu hình biến động theo tenant — thay đổi có hiệu lực ngay sau khi lưu</p>
          <div className="space-y-3">
            {configs.map(cfg => (
              <div key={cfg.key} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded font-mono border border-amber-200 dark:border-amber-500/20">{cfg.key}</code>
                    <span className="text-slate-900 dark:text-white font-bold text-sm">{cfg.label}</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">{cfg.description}</p>
                </div>
                <div className="sm:w-48 shrink-0">
                  {cfg.type === "boolean" ? (
                    <button
                      onClick={() => updateConfig(cfg.key, cfg.value === "true" ? "false" : "true")}
                      className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-all border ${
                        cfg.value === "true"
                          ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {cfg.value === "true" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {cfg.value === "true" ? "Đang bật" : "Đang tắt"}
                    </button>
                  ) : cfg.type === "select" ? (
                    <PremiumSelect
                      options={cfg.options?.map(o => ({ value: o, label: o })) ?? []}
                      value={cfg.value}
                      onChange={value => updateConfig(cfg.key, value)}
                      placeholder="Chọn giá trị..."
                      buttonClassName="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-amber-500 focus:ring-amber-500/10 active:scale-100"
                    />
                  ) : (
                    <input
                      type={cfg.type}
                      value={cfg.value}
                      onChange={e => updateConfig(cfg.key, e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => unavailableLandAction("Thao tác quản trị")} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm">
            <CheckCircle2 className="w-4 h-4" />
            Lưu Cấu Hình
          </button>
        </motion.div>
      )}

      {/* ─── Audit Log ─── */}
      {section === "audit-log" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
              placeholder="Lọc theo hành động, người dùng, resource..."
              className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="space-y-2">
            {filteredAudit.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-start gap-3 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <ResultBadge result={entry.result} />
                    <span className="text-slate-900 dark:text-white font-bold text-sm">{entry.action}</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">{entry.actor}</span>
                    {" · "}{entry.resource}
                  </p>
                  {entry.details && (
                    <p className="text-rose-600 dark:text-rose-400 text-xs mt-1 italic">{entry.details}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-xs shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(entry.timestamp).toLocaleString("vi-VN")}
                </div>
              </motion.div>
            ))}
            {filteredAudit.length === 0 && (
              <p className="text-center text-slate-400 dark:text-slate-500 text-sm italic py-8">Không có nhật ký phù hợp</p>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── Webhook DLQ ─── */}
      {section === "webhook-dlq" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-slate-500 dark:text-slate-400 text-sm">Các webhook thất bại đang chờ retry</p>
            <span className="text-xs bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 px-3 py-1 rounded-full font-bold">
              {MOCK_DLQ.length} pending
            </span>
          </div>
          {MOCK_DLQ.length === 0 && (
            <div className="text-center py-16">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3 opacity-40" />
              <p className="text-slate-400 dark:text-slate-500 text-sm">DLQ trống — tất cả webhook đang hoạt động bình thường</p>
            </div>
          )}
          {MOCK_DLQ.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-rose-50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/20 rounded-2xl p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-xs bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded font-mono">{entry.event}</code>
                    <span className="text-slate-400 dark:text-slate-500 text-xs">#{entry.id}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm truncate">{entry.endpoint}</p>
                  <p className="text-rose-600 dark:text-rose-400 text-xs mt-1 italic">{entry.lastError}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    {entry.attempts} lần thử thất bại · Lần cuối: {new Date(entry.failedAt).toLocaleString("vi-VN")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => unavailableLandAction("Thao tác quản trị")} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-bold transition-all border border-amber-200 dark:border-amber-500/20">
                    <RotateCcw className="w-3 h-3" />
                    Retry
                  </button>
                  <button onClick={() => unavailableLandAction("Thao tác quản trị")} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700">
                    <Trash2 className="w-3 h-3" />
                    Xoá
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
