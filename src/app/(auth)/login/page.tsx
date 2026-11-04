'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import { Mail, Lock, Loader2, AlertTriangle, Shield, Smartphone } from 'lucide-react';
import { validateDevelopmentLoginBypassEmail } from '@/services/dev-login-actions';
import { resolveSafePostLoginPath } from '@/lib/auth/post-login-redirect';

/**
 * Login Page - Bella Multi-Service ERP
 * Design: High-fidelity Premium Glassmorphism with background depth-of-field blur blobs
 */

type LoginStage = 'credentials' | 'mfa';

const MISSING_SUPABASE_PUBLIC_ENV_MESSAGE =
  'Supabase chưa được cấu hình cho môi trường này. Vui lòng cấu hình NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY.';

function isMissingSupabasePublicEnvError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Missing Supabase credentials');
}

export default function LoginPage() {
  const [stage, setStage] = useState<LoginStage>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPostLoginPath = () => resolveSafePostLoginPath(
    new URLSearchParams(window.location.search).get('next'),
    window.location.origin,
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { getSupabase } = await import('@/lib/supabase-client');
      const { needsMfaChallenge } = await import('@/lib/mfa');
      const supabase = getSupabase();

      // DEVELOPMENT BYPASS: dev user with password123 — preserved as-is
      if (process.env.NODE_ENV === 'development' && password === 'password123') {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password: 'password123',
        });

        if (!authError && authData?.user) {
          document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          // Still honour MFA in dev if enrolled
          if (await needsMfaChallenge()) {
            setStage('mfa');
            setLoading(false);
            return;
          }
          window.location.href = getPostLoginPath();
          return;
        }

        const bypassResult = await validateDevelopmentLoginBypassEmail(email);
        if (bypassResult.ok) {
          document.cookie = `mock_user_email=${email}; path=/; max-age=31536000; SameSite=Lax`;
          window.location.href = resolveSafePostLoginPath(bypassResult.redirectTo || getPostLoginPath(), window.location.origin);
          return;
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError(signInError.message); setLoading(false); return; }
      const requiresMfa = await needsMfaChallenge();
      if (requiresMfa) { setStage('mfa'); setLoading(false); return; }
      window.location.href = getPostLoginPath();
    } catch (err: unknown) {
      if (isMissingSupabasePublicEnvError(err)) {
        setError(MISSING_SUPABASE_PUBLIC_ENV_MESSAGE);
        setLoading(false);
        return;
      }

      console.error('[Login Error]', err);
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(mfaCode)) { setError('Mã xác minh phải gồm đúng 6 chữ số.'); return; }
    setLoading(true);
    setError(null);
    try {
      const { challengeAndVerify } = await import('@/lib/mfa');
      const result = await challengeAndVerify(mfaCode);
      if (!result.ok) { setError(result.error || 'Mã không đúng hoặc đã hết hạn.'); setLoading(false); return; }
      window.location.href = getPostLoginPath();
    } catch (err: unknown) {
      console.error('[MFA Error]', err);
      setError(err instanceof Error ? err.message : 'Xác minh thất bại. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  const handleCancelMfa = async () => {
    try {
      const { getSupabase } = await import('@/lib/supabase-client');
      await getSupabase().auth.signOut();
    } catch (err: unknown) { console.error('[SignOut Error]', err); }
    setStage('credentials');
    setPassword('');
    setMfaCode('');
    setError(null);
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      minHeight: '100dvh',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Dynamic Background Blur Blobs for luxurious depth-of-field */}
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'rgba(168, 85, 247, 0.22)',
        filter: 'blur(100px)',
        top: '10%',
        left: 'calc(50% - 320px)',
        zIndex: 0,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: '350px',
        height: '350px',
        borderRadius: '50%',
        background: 'rgba(6, 182, 212, 0.18)',
        filter: 'blur(90px)',
        bottom: '15%',
        right: 'calc(50% - 280px)',
        zIndex: 0,
        pointerEvents: 'none',
      }} />

      {/* Premium Glassmorphic card */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: '2.5rem',
        border: '1px solid rgba(255, 255, 255, 0.45)',
        boxShadow: '0 25px 55px rgba(124, 58, 237, 0.06), 0 8px 24px rgba(0, 0, 0, 0.03)',
        width: '100%',
        maxWidth: '26.5rem',
        padding: '3.5rem 2.75rem',
        zIndex: 1,
        transition: 'all 0.3s ease',
      }}>

        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'center' }}>
            <Image
              src="/bella-erp-logo.png"
              alt="Bella ERP"
              width={1024}
              height={464}
              priority
              style={{ 
                width: '62%', 
                height: 'auto',
                filter: 'drop-shadow(0 8px 24px rgba(124, 58, 237, 0.22))'
              }}
            />
          </div>

          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(224, 242, 254, 0.8)',
            border: '1px solid rgba(14, 165, 233, 0.15)',
            borderRadius: '999px',
            padding: '0.375rem 0.875rem',
            marginBottom: '0.75rem',
            backdropFilter: 'blur(4px)',
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#0ea5e9',
              boxShadow: '0 0 8px #0ea5e9',
            }} />
            <span style={{
              fontSize: '0.625rem',
              fontWeight: '800',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#0369a1',
            }}>
              MULTI-SERVICE ERP
            </span>
          </div>

          {/* Subtitle */}
          <p style={{
            fontSize: '0.875rem',
            color: '#64748b',
            fontWeight: '600',
            marginTop: '0.5rem',
          }}>
            {stage === 'mfa' ? 'Xác minh 2 lớp bảo mật' : 'Hệ thống quản trị ALL in ONE'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(254, 242, 242, 0.9)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '1rem',
            padding: '1rem 1.125rem',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backdropFilter: 'blur(4px)',
          }}>
            <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span style={{ color: '#b91c1c', fontSize: '0.875rem', fontWeight: '600', lineHeight: 1.4 }}>
              {error}
            </span>
          </div>
        )}

        {/* Credentials Form */}
        {stage === 'credentials' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
            {/* Email */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.6875rem',
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.5rem',
                marginLeft: '0.25rem',
              }}>
                Email công việc
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{
                  position: 'absolute',
                  left: '1.25rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  transition: 'color 0.2s',
                }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email"
                  disabled={loading}
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '0.9375rem 1.25rem 0.9375rem 3.25rem',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    borderRadius: '1rem',
                    fontSize: '0.9375rem',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    background: 'rgba(255, 255, 255, 0.85)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#7c3aed';
                    e.target.style.background = 'white';
                    e.target.style.boxShadow = '0 0 0 4px rgba(124,58,237,0.15)';
                    const parent = e.target.parentElement;
                    if (parent) {
                      const icon = parent.querySelector('svg');
                      if (icon) icon.style.color = '#7c3aed';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(226, 232, 240, 0.8)';
                    e.target.style.background = 'rgba(255, 255, 255, 0.85)';
                    e.target.style.boxShadow = 'none';
                    const parent = e.target.parentElement;
                    if (parent) {
                      const icon = parent.querySelector('svg');
                      if (icon) icon.style.color = '#94a3b8';
                    }
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.6875rem',
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.5rem',
                marginLeft: '0.25rem',
              }}>
                Mật khẩu
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{
                  position: 'absolute',
                  left: '1.25rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  transition: 'color 0.2s',
                }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '0.9375rem 1.25rem 0.9375rem 3.25rem',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    borderRadius: '1rem',
                    fontSize: '0.9375rem',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    background: 'rgba(255, 255, 255, 0.85)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#7c3aed';
                    e.target.style.background = 'white';
                    e.target.style.boxShadow = '0 0 0 4px rgba(124,58,237,0.15)';
                    const parent = e.target.parentElement;
                    if (parent) {
                      const icon = parent.querySelector('svg');
                      if (icon) icon.style.color = '#7c3aed';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(226, 232, 240, 0.8)';
                    e.target.style.background = 'rgba(255, 255, 255, 0.85)';
                    e.target.style.boxShadow = 'none';
                    const parent = e.target.parentElement;
                    if (parent) {
                      const icon = parent.querySelector('svg');
                      if (icon) icon.style.color = '#94a3b8';
                    }
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                background: loading
                  ? '#e2e8f0'
                  : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                color: loading ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '1.25rem',
                fontSize: '0.9375rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 10px 30px rgba(124, 58, 237, 0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                marginTop: '0.625rem',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 15px 35px rgba(124, 58, 237, 0.42)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(124, 58, 237, 0.3)';
                }
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Loader2 className="animate-spin" size={18} />
                  Đang đăng nhập...
                </span>
              ) : (
                'Đăng nhập ngay'
              )}
            </button>
          </form>
        )}

        {/* MFA Form */}
        {stage === 'mfa' && (
          <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
            {/* Info */}
            <div style={{
              background: 'rgba(240, 249, 255, 0.9)',
              border: '1px solid rgba(186, 230, 253, 0.4)',
              borderRadius: '1rem',
              padding: '1.125rem',
              display: 'flex',
              gap: '0.75rem',
              backdropFilter: 'blur(4px)',
            }}>
              <Smartphone size={20} style={{ color: '#0284c7', flexShrink: 0, marginTop: '0.125rem' }} />
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: '750', color: '#0369a1', marginBottom: '0.25rem' }}>
                  Xác minh 2 lớp bảo mật
                </p>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.5, fontWeight: '500' }}>
                  Mở ứng dụng Authenticator và nhập mã 6 số đang hiển thị.
                </p>
              </div>
            </div>

            {/* MFA Code */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.6875rem',
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.5rem',
                marginLeft: '0.25rem',
              }}>
                <Shield size={13} style={{ color: '#7c3aed' }} />
                Mã xác minh
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  borderRadius: '1rem',
                  fontSize: '2rem',
                  fontWeight: '900',
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  fontFamily: 'monospace',
                  color: '#1e293b',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  background: 'rgba(255, 255, 255, 0.85)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#7c3aed';
                  e.target.style.background = 'white';
                  e.target.style.boxShadow = '0 0 0 4px rgba(124,58,237,0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(226, 232, 240, 0.8)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.85)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              style={{
                width: '100%',
                padding: '1rem',
                background: (loading || mfaCode.length !== 6)
                  ? '#e2e8f0'
                  : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                color: (loading || mfaCode.length !== 6) ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '1.25rem',
                fontSize: '0.9375rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                cursor: (loading || mfaCode.length !== 6) ? 'not-allowed' : 'pointer',
                boxShadow: (loading || mfaCode.length !== 6) ? 'none' : '0 10px 30px rgba(124, 58, 237, 0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => {
                if (!loading && mfaCode.length === 6) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 15px 35px rgba(124, 58, 237, 0.42)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && mfaCode.length === 6) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(124, 58, 237, 0.3)';
                }
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Loader2 className="animate-spin" size={18} />
                  Đang xác minh...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Shield size={16} />
                  Xác minh
                </span>
              )}
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={handleCancelMfa}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.625rem',
                background: 'transparent',
                color: '#64748b',
                border: 'none',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.color = '#475569'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.color = '#64748b'; }}
            >
              ← Huỷ &amp; đăng nhập lại
            </button>
          </form>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '2.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid rgba(226, 232, 240, 0.6)',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: '500' }}>
            Gặp sự cố?{' '}
            <a href="mailto:support@bella.vn" style={{ color: '#7c3aed', fontWeight: '750', textDecoration: 'none' }}>
              Liên hệ kỹ thuật
            </a>
          </p>
        </div>
      </div>

      {/* Copyright */}
      <p style={{
        marginTop: '2.5rem',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.75rem',
        fontWeight: '600',
        zIndex: 1,
      }}>
        © {new Date().getFullYear()} Bella Group — All rights reserved
      </p>
    </div>
  );
}
