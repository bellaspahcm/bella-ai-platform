"use client";

import { useState, useEffect, useCallback } from "react";
import {
  KeyRound,
  ShieldCheck,
  Loader2,
  Smartphone,
  Copy,
  Check,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";
import { createClient } from "@/lib/supabase-client";
import {
  enrollTotp,
  verifyEnrollment,
  listFactors,
  unenrollTotp,
  type MfaFactor,
} from "@/lib/mfa";

export default function SecurityTab() {
  // ─── Password section state ───────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // ─── MFA section state ────────────────────────────────────────────
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [enrollState, setEnrollState] = useState<
    | { stage: "idle" }
    | { stage: "enrolling" }
    | { stage: "verifying"; factorId: string; qrSvg: string; secret: string; code: string }
    | { stage: "submitting"; factorId: string; qrSvg: string; secret: string; code: string }
  >({ stage: "idle" });
  const [secretCopied, setSecretCopied] = useState(false);

  const verifiedTotp = factors.find(
    (f) => f.factorType === "totp" && f.status === "verified",
  );

  const refreshFactors = useCallback(async () => {
    setLoadingFactors(true);
    const list = await listFactors();
    setFactors(list);
    setLoadingFactors(false);
  }, []);

  useEffect(() => {
    refreshFactors();
  }, [refreshFactors]);

  // ─── Password update handler ──────────────────────────────────────
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu mới không khớp!");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự!");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user || !user.email) {
        toast.error("Không tìm thấy thông tin phiên đăng nhập!");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        toast.error("Mật khẩu cũ không chính xác!");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error("Không thể đổi mật khẩu: " + error.message);
      } else {
        toast.success("Đổi mật khẩu thành công!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      toast.error("Đã xảy ra lỗi: " + msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── MFA handlers ─────────────────────────────────────────────────
  const handleStartEnroll = async () => {
    setEnrollState({ stage: "enrolling" });
    const result = await enrollTotp("Bella ERP Authenticator");
    if (!result.ok) {
      toast.error("Không thể bắt đầu thiết lập 2FA: " + result.error);
      setEnrollState({ stage: "idle" });
      return;
    }
    setEnrollState({
      stage: "verifying",
      factorId: result.factorId,
      qrSvg: result.qrSvg,
      secret: result.secret,
      code: "",
    });
  };

  const handleVerify = async () => {
    if (enrollState.stage !== "verifying") return;
    if (!/^\d{6}$/.test(enrollState.code)) {
      toast.error("Mã xác minh phải gồm đúng 6 chữ số.");
      return;
    }
    setEnrollState({ ...enrollState, stage: "submitting" });
    const result = await verifyEnrollment(enrollState.factorId, enrollState.code);
    if (!result.ok) {
      toast.error("Mã không đúng: " + result.error);
      setEnrollState({ ...enrollState, stage: "verifying" });
      return;
    }
    toast.success("Đã kích hoạt 2FA thành công! Lần đăng nhập sau bạn sẽ cần mã từ app.");
    setEnrollState({ stage: "idle" });
    await refreshFactors();
  };

  const handleCancelEnroll = async () => {
    if (enrollState.stage === "verifying" || enrollState.stage === "submitting") {
      // Best-effort cleanup of the unverified factor
      try {
        await unenrollTotp(enrollState.factorId);
      } catch {
        /* ignore */
      }
    }
    setEnrollState({ stage: "idle" });
  };

  const handleUnenroll = async (factorId: string) => {
    if (
      !window.confirm(
        "Tắt 2FA sẽ làm giảm độ bảo mật của tài khoản. Bạn chắc chắn muốn tiếp tục?",
      )
    )
      return;
    const result = await unenrollTotp(factorId);
    if (!result.ok) {
      toast.error("Không thể gỡ 2FA: " + result.error);
      return;
    }
    toast.success("Đã tắt 2FA.");
    await refreshFactors();
  };

  const handleCopySecret = async () => {
    if (enrollState.stage !== "verifying" && enrollState.stage !== "submitting") return;
    const success = await copyToClipboard(enrollState.secret);
    if (success) {
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 1500);
    } else {
      toast.error("Không thể tự động sao chép secret key");
    }
  };

  return (
    <div className="space-y-12">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight flex items-center gap-3">
          <KeyRound className="text-primary w-6 h-6" />
          Bảo mật & Mật khẩu
        </h2>
        <p className="text-muted-foreground font-semibold mt-2">
          Quản lý mật khẩu và xác thực 2 lớp (2FA) cho tài khoản của bạn
        </p>
      </div>

      {/* ─── Password section ───────────────────────────────── */}
      <section className="bg-white/40 dark:bg-black/20 p-8 rounded-3xl border border-white/50 dark:border-white/10 shadow-sm">
        <h3 className="text-lg font-black text-foreground uppercase tracking-tight flex items-center gap-2 mb-6">
          <KeyRound className="text-primary w-5 h-5" />
          Đổi mật khẩu
        </h3>
        <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-md">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
              Mật khẩu cũ
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-white/60 dark:bg-black/40 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
              Mật khẩu mới
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-white/60 dark:bg-black/40 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
              Nhập lại mật khẩu mới
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-white/60 dark:bg-black/40 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-primary hover:bg-primary-hover disabled:bg-muted text-primary-foreground font-black py-4 rounded-2xl shadow-xl shadow-primary/25 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3 text-sm uppercase tracking-widest"
          >
            {isSaving ? (
              <Loader2 className="animate-spin w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
            {isSaving ? "Đang xử lý..." : "Đổi mật khẩu"}
          </button>
        </form>
      </section>

      {/* ─── 2FA section ────────────────────────────────────── */}
      <section className="bg-white/40 dark:bg-black/20 p-8 rounded-3xl border border-white/50 dark:border-white/10 shadow-sm">
        <h3 className="text-lg font-black text-foreground uppercase tracking-tight flex items-center gap-2 mb-2">
          <Smartphone className="text-primary w-5 h-5" />
          Xác thực 2 lớp (2FA)
        </h3>
        <p className="text-sm text-muted-foreground font-semibold mb-6">
          Bổ sung 1 mã 6 chữ số từ ứng dụng (Google Authenticator, Authy, 1Password)
          mỗi khi đăng nhập. Bắt buộc với role HQ Owner, Admin, Kế toán trưởng.
        </p>

        {loadingFactors ? (
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <Loader2 className="animate-spin w-4 h-4" /> Đang tải trạng thái 2FA…
          </div>
        ) : verifiedTotp ? (
          /* ─── Already enrolled ─── */
          <div className="space-y-4 max-w-md">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1">
                <p className="font-bold text-emerald-700 dark:text-emerald-300">
                  2FA đang BẬT
                </p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                  {verifiedTotp.friendlyName ?? "Authenticator"} · kích hoạt{" "}
                  {new Date(verifiedTotp.createdAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleUnenroll(verifiedTotp.id)}
              className="flex items-center gap-2 text-sm font-bold text-rose-600 hover:text-rose-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Gỡ 2FA
            </button>
          </div>
        ) : enrollState.stage === "idle" ? (
          /* ─── Not enrolled — show CTA ─── */
          <div className="space-y-4 max-w-md">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold text-amber-700 dark:text-amber-300">2FA chưa bật</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                  Tài khoản chỉ được bảo vệ bằng mật khẩu — rủi ro cao nếu mật khẩu bị lộ.
                </p>
              </div>
            </div>
            <button
              onClick={handleStartEnroll}
              className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-black py-4 rounded-2xl shadow-xl shadow-primary/25 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3 text-sm uppercase tracking-widest"
            >
              <Smartphone className="w-5 h-5" />
              Bật 2FA ngay
            </button>
          </div>
        ) : enrollState.stage === "enrolling" ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="animate-spin w-5 h-5" />
            Đang tạo mã QR…
          </div>
        ) : (
          /* ─── Enrolling: show QR + verify form ─── */
          <div className="space-y-6 max-w-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-2xl border border-border flex items-center justify-center">
                <div
                  className="w-48 h-48"
                  dangerouslySetInnerHTML={{ __html: enrollState.qrSvg }}
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-bold text-foreground">
                  1. Mở app authenticator (Google Authenticator, Authy, 1Password)
                </p>
                <p className="text-sm font-bold text-foreground">
                  2. Quét mã QR bên cạnh — hoặc nhập secret thủ công:
                </p>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl">
                  <code className="text-xs font-mono break-all flex-1">
                    {enrollState.secret}
                  </code>
                  <button
                    onClick={handleCopySecret}
                    className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                    title="Copy secret"
                  >
                    {secretCopied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <p className="text-sm font-bold text-foreground">
                  3. Nhập mã 6 số app hiển thị:
                </p>
              </div>
            </div>

            <div className="space-y-3 max-w-xs">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={enrollState.code}
                onChange={(e) => {
                  if (enrollState.stage !== "verifying") return;
                  setEnrollState({
                    ...enrollState,
                    code: e.target.value.replace(/\D/g, "").slice(0, 6),
                  });
                }}
                disabled={enrollState.stage === "submitting"}
                className="block w-full text-center text-2xl font-black tracking-[0.5em] px-4 py-4 bg-white/60 dark:bg-black/40 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground"
                placeholder="000000"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={handleVerify}
                  disabled={enrollState.stage === "submitting"}
                  className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground font-black py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
                >
                  {enrollState.stage === "submitting" ? (
                    <Loader2 className="animate-spin w-4 h-4" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  Xác minh
                </button>
                <button
                  onClick={handleCancelEnroll}
                  disabled={enrollState.stage === "submitting"}
                  className="px-4 py-3 rounded-2xl border border-border hover:bg-muted/30 transition-colors text-sm font-bold text-muted-foreground"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
