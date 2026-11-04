"use client";

import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { getSupabase } from "@/lib/supabase-client";
import { cn, copyToClipboard } from "@/lib/utils";
import {
createUser,
deleteUser,
getUsers,
updateUser,
updateUserStatus,
} from "@/services/user-actions";
import type { StaffRecord } from "@/modules/spa/types/employee";
import { useModuleVocabulary } from "@/hooks/useModuleVocabulary";
import { useTenantModuleKey } from "@/hooks/useTenantModuleKey";
import { AnimatePresence,motion } from "framer-motion";
import {
  Check,
  Copy,
  Mail,
  Pencil,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  User,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import React,{ useEffect,useState } from "react";
import { toast } from "sonner";

function getRoleBadge(role: string | null | undefined, isEdu: boolean, workerVocab: { singular: string; role: string }) {
  const normalized = role?.toLowerCase() || "";
  if (isEdu) {
    if (normalized === "admin" || normalized === "super_admin" || normalized === "owner") {
      return { label: "Hiệu trưởng / Quản trị viên", color: "bg-rose-50 text-rose-600 border-rose-100" };
    }
    if (normalized === "principal") {
      return { label: "Hiệu trưởng", color: "bg-rose-50 text-rose-600 border-rose-100" };
    }
    if (normalized === "campus_admin" || normalized === "manager") {
      return { label: "Quản lý cơ sở / Hiệu phó", color: "bg-indigo-50 text-indigo-600 border-indigo-100" };
    }
    if (normalized === "lead_teacher" || normalized === "teacher_lead" || normalized === "ktv_lead") {
      return { label: "Tổ trưởng chuyên môn", color: "bg-amber-50 text-amber-600 border-amber-100" };
    }
    if (normalized === "teacher" || normalized === "ktv") {
      return { label: "Giáo viên mầm non", color: "bg-blue-50 text-blue-600 border-blue-100" };
    }
    if (normalized === "caretaker" || normalized === "nanny") {
      return { label: "Bảo mẫu / Chăm sóc", color: "bg-purple-50 text-purple-600 border-purple-100" };
    }
    if (normalized === "accountant") {
      return { label: "Kế toán trường", color: "bg-emerald-50 text-emerald-600 border-emerald-100" };
    }
    if (normalized === "nurse") {
      return { label: "Nhân viên Y tế", color: "bg-teal-50 text-teal-600 border-teal-100" };
    }
    if (normalized === "admin_staff" || normalized === "staff" || normalized === "education_staff") {
      return { label: "Giáo vụ / Nhân viên", color: "bg-slate-50 text-slate-600 border-slate-100" };
    }
    if (normalized === "hr") {
      return { label: "Hành chính nhân sự", color: "bg-violet-50 text-violet-600 border-violet-100" };
    }
    return { label: role || "Giáo viên", color: "bg-blue-50 text-blue-600 border-blue-100" };
  }

  // SPA roles
  if (normalized === "admin") return { label: "Quản trị viên", color: "bg-rose-50 text-rose-600 border-rose-100" };
  if (normalized === "ktv") return { label: workerVocab.singular, color: "bg-blue-50 text-blue-600 border-blue-100" };
  if (normalized === "ktv_lead") return { label: `${workerVocab.role} Trưởng`, color: "bg-amber-50 text-amber-600 border-amber-100" };
  if (normalized === "admin_staff") return { label: "Lễ tân / Staff", color: "bg-slate-50 text-slate-600 border-slate-100" };
  if (normalized === "accountant") return { label: "Kế toán", color: "bg-emerald-50 text-emerald-600 border-emerald-100" };
  if (normalized === "hr") return { label: "Nhân sự", color: "bg-violet-50 text-violet-600 border-violet-100" };
  return { label: role || "Nhân viên", color: "bg-slate-50 text-slate-600 border-slate-100" };
}

export default function StaffManagementTab() {
  const vocab = useModuleVocabulary();
  const { tenantModuleKey } = useTenantModuleKey();
  const isEducation = tenantModuleKey === "bella_education";
  const [users, setUsers] = useState<StaffRecord[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newStaff, setNewStaff] = useState({
    full_name: "",
    email: "",
    role: "ktv",
  });

  const [createdStaffResult, setCreatedStaffResult] = useState<{
    full_name: string;
    email: string;
    password?: string;
    emailSent?: boolean;
    reason?: string;
  } | null>(null);
  const [copiedPwd, setCopiedPwd] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingStaff, setEditingStaff] = useState({
    id: "",
    full_name: "",
    email: "",
    role: "ktv",
    position_tier: null as 'junior' | 'senior' | 'lead' | null,
    hire_date: null as string | null,
  });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState({
    id: "",
    full_name: "",
  });

  async function fetchUsers() {
    setIsLoadingUsers(true);
    try {
      const data = await getUsers();
      setUsers(data as StaffRecord[]);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Không thể tải danh sách nhân sự");
    } finally {
      setIsLoadingUsers(false);
    }
  }

  useEffect(() => {
    fetchUsers();

    const sb = getSupabase();
    // Realtime subscription
    const channel = sb
      .channel("users-changes-tab")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          fetchUsers();
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const result = await updateUserStatus(id, newStatus);
    if (result.success) {
      toast.success("Đã cập nhật trạng thái nhân sự");
      fetchUsers();
    } else {
      toast.error("Lỗi khi cập nhật: " + result.error);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.full_name || !newStaff.email) {
      toast.error("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setIsAdding(true);
    try {
      const result = await createUser(newStaff);
      if (result.error) {
        toast.error("Lỗi: " + result.error);
      } else {
        const pwd = (result as { defaultPassword?: string }).defaultPassword;
        const emailSent = (result as { emailSent?: boolean }).emailSent;
        const emailError = (result as { emailError?: string }).emailError;

        if (pwd) {
          let reason = "";
          if (!emailSent) {
            reason = "Hệ thống chưa cấu hình gửi mail tự động";
            if (emailError && emailError !== "SMTP_CONFIG_MISSING") {
              if (emailError.includes("534-5.7.9") || emailError.includes("Invalid login")) {
                reason = "Tài khoản Gmail SMTP yêu cầu Mật khẩu ứng dụng (App Password)";
              } else {
                reason = `Lỗi gửi mail: ${emailError.substring(0, 60)}`;
              }
            }
          }

          setCreatedStaffResult({
            full_name: newStaff.full_name,
            email: newStaff.email,
            password: pwd,
            emailSent,
            reason,
          });
          setCopiedPwd(false);

          toast.success(
            () => (
              <div className="flex flex-col gap-2 p-1">
                <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>Đã thêm nhân sự {newStaff.full_name}!</span>
                </div>
                {reason && (
                  <p className="text-xs text-amber-700 font-medium">
                    ⚠️ {reason}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-slate-500">Mật khẩu:</span>
                  <code className="px-2.5 py-1 bg-slate-100 text-rose-600 font-mono font-bold text-xs rounded border border-slate-200 select-all">
                    {pwd}
                  </code>
                  <button
                    type="button"
                    onClick={async (evt) => {
                      evt.stopPropagation();
                      const success = await copyToClipboard(pwd);
                      if (success) {
                        toast.success("Đã sao chép mật khẩu!", { id: "copy-toast" });
                      } else {
                        toast.error("Không thể tự động sao chép mật khẩu");
                      }
                    }}
                    className="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-bold rounded flex items-center gap-1 hover:bg-primary-hover transition-all active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
              </div>
            ),
            { duration: 20000 }
          );
        } else {
          toast.success("Đã thêm nhân viên " + newStaff.full_name);
        }
        setIsAddModalOpen(false);
        setNewStaff({ full_name: "", email: "", role: "ktv" });
        fetchUsers();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Đã xảy ra lỗi khi thêm nhân sự: " + msg);
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff.full_name) {
      toast.error("Vui lòng nhập họ và tên");
      return;
    }

    // Validate hire date not in future
    if (editingStaff.hire_date && new Date(editingStaff.hire_date) > new Date()) {
      toast.error("Ngày vào làm không thể là ngày trong tương lai");
      return;
    }

    setIsUpdating(true);
    try {
      const result = await updateUser(editingStaff.id, {
        full_name: editingStaff.full_name,
        role: editingStaff.role,
        position_tier: editingStaff.position_tier,
        hire_date: editingStaff.hire_date,
      });
      if (result.error) {
        toast.error("Lỗi: " + result.error);
      } else {
        toast.success("Đã cập nhật thông tin nhân viên");
        setIsEditModalOpen(false);
        fetchUsers();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Đã xảy ra lỗi khi cập nhật: " + msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteStaff = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteUser(deletingStaff.id);
      if (result.error) {
        toast.error("Lỗi: " + result.error);
      } else {
        toast.success("Đã xóa nhân viên");
        setIsDeleteModalOpen(false);
        fetchUsers();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Đã xảy ra lỗi khi xóa: " + msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bella-toolbar mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Nhân sự {'&'} Quyền
            </h2>
            <p className="text-sm text-muted-foreground font-semibold">
              Quản lý danh sách nhân viên và phân quyền hệ thống
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-6 py-3 bg-primary/10 text-primary rounded-xl font-black text-sm uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Thêm nhân sự
        </button>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-white bg-white/40 shadow-sm">
        <div className="overflow-x-auto overscroll-x-contain custom-scrollbar">
          <table className="bella-data-table min-w-[76rem] text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/50">
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                  Họ và tên
                </th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                  Vai trò
                </th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                  {isEducation ? "Chuyên môn / Đứng lớp" : "Hiệu suất"}
                </th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                  Email
                </th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                  Trạng thái
                </th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-right min-w-[150px]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20">
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground font-bold">
                      Đang tải dữ liệu...
                    </p>
                  </td>
                </tr>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="group hover:bg-white/60 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center text-primary font-black text-sm border-2 border-white relative">
                          {user.full_name?.substring(0, 2).toUpperCase()}
                          {user.avg_rating && parseFloat(user.avg_rating.toString()) >= 4.9 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center border border-white">
                              <Star className="w-2 h-2 text-white fill-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-black text-slate-900">
                            {user.full_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            Mã NV: {user.id.substring(0, 5).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {(() => {
                        const badge = getRoleBadge(user.role, isEducation, vocab.worker);
                        return (
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                              badge.color
                            )}
                          >
                            {badge.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-8 py-6">
                      {isEducation ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Đang đứng lớp
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            <span className="text-xs font-black text-slate-700">
                              {user.avg_rating || "5.0"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span className="text-xs font-black text-slate-700">
                              {user.sessions_count || 0} buổi
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Star className="w-3 h-3 text-rose-400 fill-rose-400" />
                            <span className="text-xs font-black text-slate-700">
                              {user.avg_rating || "5.0"}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6 font-bold text-slate-500 text-sm italic">
                      {user.email}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div
                        onClick={() => handleToggleStatus(user.id, user.status)}
                        className={cn(
                          "w-12 h-6 rounded-full p-1 transition-all cursor-pointer mx-auto border border-transparent",
                          user.status === "active" ? "bg-emerald-500" : "bg-slate-300 border-slate-400/20",
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                            user.status === "active" ? "ml-6" : "ml-0",
                          )}
                        />
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingStaff({
                              id: user.id,
                              full_name: user.full_name,
                              email: user.email,
                              role: user.role || "ktv",
                              position_tier: user.position_tier || null,
                              hire_date: user.hire_date || null,
                            });
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                          title="Chỉnh sửa"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingStaff({
                              id: user.id,
                              full_name: user.full_name,
                            });
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-2 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                          title="Xóa nhân sự"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="py-20 text-center text-muted-foreground font-bold italic"
                  >
                    Chưa có dữ liệu nhân sự
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl relative z-10 overflow-visible flex flex-col border border-white"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      Thêm nhân sự mới
                    </h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                      Thiết lập tài khoản {'&'} vai trò
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-400 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddStaff} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Họ và tên
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaff.full_name}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, full_name: e.target.value })
                    }
                    placeholder="VD: Nguyễn Thị Lan"
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold text-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> Địa chỉ Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newStaff.email}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, email: e.target.value })
                    }
                    placeholder="lan.nt@bellaspa.vn"
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold text-slate-700"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5" /> Vai trò {'&'} Quyền hạn
                  </label>
                  <PremiumSelect
                    value={newStaff.role}
                    onChange={(val) => setNewStaff({ ...newStaff, role: val })}
                    options={
                      isEducation
                        ? [
                            { value: "ktv", label: "Giáo viên mầm non" },
                            { value: "ktv_lead", label: "Tổ trưởng chuyên môn" },
                            { value: "admin_staff", label: "Giáo vụ / Nhân viên" },
                            { value: "accountant", label: "Kế toán trường" },
                            { value: "admin", label: "Quản trị viên / Hiệu trưởng" },
                          ]
                        : [
                            { value: "ktv", label: vocab.worker.singular },
                            { value: "ktv_lead", label: `${vocab.worker.role} Trưởng (Tổ trưởng)` },
                            { value: "admin_staff", label: "Lễ tân / Nhân viên" },
                            { value: "accountant", label: "Kế toán" },
                            { value: "hr", label: "Nhân sự (HR)" },
                            { value: "admin", label: "Quản trị viên (Admin)" },
                          ]
                    }
                    placeholder="Chọn vai trò..."
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isAdding}
                    className="w-full bg-primary text-primary-foreground py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/25 dark:shadow-none flex items-center justify-center gap-3 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isAdding ? (
                      <Sparkles className="w-5 h-5 animate-spin" />
                    ) : (
                      <UserPlus className="w-5 h-5" />
                    )}
                    <span>{isAdding ? "Đang khởi tạo..." : "Xác nhận thêm nhân sự"}</span>
                  </button>
                  <p className="text-center text-[10px] text-slate-400 font-bold uppercase mt-4">
                    Nhân viên mới sẽ nhận được email hướng dẫn kích hoạt tài khoản
                  </p>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Staff Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl relative z-10 overflow-visible flex flex-col border border-white"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Pencil className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      Cập nhật nhân sự
                    </h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                      Chỉnh sửa thông tin và vai trò
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-400 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateStaff} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Họ và tên
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStaff.full_name}
                    onChange={(e) =>
                      setEditingStaff({ ...editingStaff, full_name: e.target.value })
                    }
                    placeholder="VD: Nguyễn Thị Lan"
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold text-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> Địa chỉ Email
                  </label>
                  <input
                    type="email"
                    required
                    disabled
                    value={editingStaff.email}
                    className="w-full px-6 py-4 bg-slate-100 border-none rounded-2xl outline-none font-bold text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-muted-foreground italic ml-2">Không thể thay đổi email sau khi tạo.</p>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5" /> Vai trò {'&'} Quyền hạn
                  </label>
                  <PremiumSelect
                    value={editingStaff.role}
                    onChange={(val) => setEditingStaff({ ...editingStaff, role: val })}
                    options={
                      isEducation
                        ? [
                            { value: "ktv", label: "Giáo viên mầm non" },
                            { value: "ktv_lead", label: "Tổ trưởng chuyên môn" },
                            { value: "admin_staff", label: "Giáo vụ / Nhân viên" },
                            { value: "accountant", label: "Kế toán trường" },
                            { value: "admin", label: "Quản trị viên / Hiệu trưởng" },
                          ]
                        : [
                            { value: "ktv", label: vocab.worker.singular },
                            { value: "ktv_lead", label: `${vocab.worker.role} Trưởng (Tổ trưởng)` },
                            { value: "admin_staff", label: "Lễ tân / Nhân viên" },
                            { value: "accountant", label: "Kế toán" },
                            { value: "hr", label: "Nhân sự (HR)" },
                            { value: "admin", label: "Quản trị viên (Admin)" },
                          ]
                    }
                    placeholder="Chọn vai trò..."
                  />
                </div>

                {/* Position Tier - Only for KTV roles */}
                {(editingStaff.role === 'ktv' || editingStaff.role === 'ktv_lead') && !isEducation && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5" /> Cấp bậc (Position Tier)
                    </label>
                    <PremiumSelect
                      value={editingStaff.position_tier || ''}
                      onChange={(val) => setEditingStaff({ ...editingStaff, position_tier: val as 'junior' | 'senior' | 'lead' | null })}
                      options={[
                        { value: '', label: 'Chưa xác định' },
                        { value: 'junior', label: 'Junior (1.0x - Cơ bản)' },
                        { value: 'senior', label: 'Senior (1.2x - Cao hơn 20%)' },
                        { value: 'lead', label: 'Lead (1.5x - Cao hơn 50%)' },
                      ]}
                      placeholder="Chọn cấp bậc..."
                    />
                    <p className="text-[10px] text-slate-400 italic ml-2">
                      Cấp bậc ảnh hưởng đến hệ số hoa hồng trong tính lương
                    </p>
                  </div>
                )}

                {/* Hire Date - Only for KTV roles */}
                {(editingStaff.role === 'ktv' || editingStaff.role === 'ktv_lead') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Star className="w-3.5 h-3.5" /> Ngày vào làm
                    </label>
                    <input
                      type="date"
                      value={editingStaff.hire_date || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, hire_date: e.target.value || null })}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold text-slate-700"
                    />
                    {editingStaff.hire_date && (() => {
                      const years = Math.floor((new Date().getTime() - new Date(editingStaff.hire_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                      const bonusRate = years === 0 ? 0 : years < 1 ? 0 : years < 3 ? 5 : years < 5 ? 10 : 15;
                      return (
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-xs font-bold text-emerald-600">
                            {years} năm thâm niên
                          </span>
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black">
                            +{bonusRate}% thưởng thâm niên
                          </span>
                        </div>
                      );
                    })()}
                    <p className="text-[10px] text-slate-400 italic ml-2">
                      Thâm niên ảnh hưởng đến thưởng theo năm công tác
                    </p>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full bg-primary text-primary-foreground py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/25 dark:shadow-none flex items-center justify-center gap-3 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <Sparkles className="w-5 h-5 animate-spin" />
                    ) : (
                      <Pencil className="w-5 h-5" />
                    )}
                    <span>{isUpdating ? "Đang lưu..." : "Lưu thay đổi"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Staff Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col border border-white text-center p-10"
            >
              <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Xóa nhân sự?</h2>
              <p className="text-slate-500 mb-8 font-medium">
                Bạn có chắc chắn muốn xóa nhân sự <strong className="text-slate-900">{deletingStaff.full_name}</strong> khỏi hệ thống? Thao tác này không thể hoàn tác.
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteStaff}
                  disabled={isDeleting}
                  className="flex-1 bg-rose-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-rose-200 dark:shadow-none flex items-center justify-center gap-2 hover:bg-rose-600 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Sparkles className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Xóa ngay</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal showing Password with 1-click Copy */}
      <AnimatePresence>
        {createdStaffResult && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreatedStaffResult(null)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col border border-white p-8 text-center"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8" />
              </div>

              <h2 className="text-2xl font-black text-slate-900 mb-1 uppercase tracking-tight">
                Thêm nhân sự thành công!
              </h2>
              <p className="text-sm text-slate-500 font-medium mb-6">
                Đã khởi tạo tài khoản cho <strong className="text-slate-800">{createdStaffResult.full_name}</strong> ({createdStaffResult.email})
              </p>

              {createdStaffResult.reason && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs text-amber-800 font-medium leading-relaxed flex items-start gap-2">
                  <span className="text-base">⚠️</span>
                  <div>
                    <strong>Lưu ý về gửi mail:</strong> {createdStaffResult.reason}. Vui lòng sao chép mật khẩu bên dưới và bàn giao trực tiếp cho nhân viên.
                  </div>
                </div>
              )}

              {createdStaffResult.password && (
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-6 space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    Mật khẩu tạm thời của nhân viên
                  </label>
                  <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-inner">
                    <code className="text-base md:text-lg font-mono font-bold text-rose-600 tracking-wider break-all select-all px-2">
                      {createdStaffResult.password}
                    </code>
                    <button
                      type="button"
                      onClick={async () => {
                        if (createdStaffResult.password) {
                          const success = await copyToClipboard(createdStaffResult.password);
                          if (success) {
                            setCopiedPwd(true);
                            toast.success("Đã sao chép mật khẩu vào bộ nhớ tạm!");
                            setTimeout(() => setCopiedPwd(false), 3000);
                          } else {
                            toast.error("Không thể tự động sao chép mật khẩu");
                          }
                        }
                      }}
                      className={cn(
                        "px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shrink-0 shadow-md cursor-pointer",
                        copiedPwd
                          ? "bg-emerald-600 text-white"
                          : "bg-primary text-primary-foreground hover:bg-primary-hover"
                      )}
                    >
                      {copiedPwd ? (
                        <>
                          <Check className="w-4 h-4" /> Đã sao chép
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" /> Sao chép mật khẩu
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 italic">
                    Nhân viên sẽ được yêu cầu đổi mật khẩu khi đăng nhập lần đầu.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setCreatedStaffResult(null)}
                className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary-hover transition-all active:scale-95 cursor-pointer"
              >
                Hoàn tất {'&'} Đóng
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
