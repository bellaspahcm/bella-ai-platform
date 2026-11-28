'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  Cpu,
  ShieldCheck,
  BarChart3,
  ArrowRight,
  LogIn,
  Menu,
  X,
  Sparkles,
  Workflow,
  Shield,
  Activity,
  Heart,
  CheckCircle2,
  Database,
  Brain,
  ArrowUpRight,
  Percent,
  Coins
} from 'lucide-react';
import { toast } from 'sonner';

const tabVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -15, transition: { duration: 0.3 } }
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'scheduler' | 'decision' | 'finance'>('scheduler');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse move handler for spotlight glow tracking
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Hệ thống đã ghi nhận thông tin. Chuyên viên Bella EIP sẽ liên hệ tư vấn trong 15 phút. 🚀');
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        .tech-font-wrapper {
          font-size: 1.08rem !important;
        }

        /* 8% font size scaling for standard text classes */
        .tech-font-wrapper .text-xs { font-size: calc(0.75rem * 1.08) !important; }
        .tech-font-wrapper .text-sm { font-size: calc(0.875rem * 1.08) !important; }
        .tech-font-wrapper .text-base { font-size: calc(1rem * 1.08) !important; }
        .tech-font-wrapper .text-lg { font-size: calc(1.125rem * 1.08) !important; }
        .tech-font-wrapper .text-xl { font-size: calc(1.25rem * 1.08) !important; }
        .tech-font-wrapper .text-2xl { font-size: calc(1.5rem * 1.08) !important; }
        .tech-font-wrapper .text-3xl { font-size: calc(1.875rem * 1.08) !important; }
        .tech-font-wrapper .text-4xl { font-size: calc(2.25rem * 1.08) !important; }
        .tech-font-wrapper .text-5xl { font-size: calc(3rem * 1.08) !important; }
        .tech-font-wrapper .text-6xl { font-size: calc(3.75rem * 1.08) !important; }
        .tech-font-wrapper .text-\\[62px\\] { font-size: calc(62px * 1.08) !important; }
        .tech-font-wrapper .text-\\[10px\\] { font-size: calc(10px * 1.08) !important; }
        .tech-font-wrapper .text-\\[11px\\] { font-size: calc(11px * 1.08) !important; }
        .tech-font-wrapper .text-\\[17px\\] { font-size: calc(17px * 1.08) !important; }
        .tech-font-wrapper .text-\\[8px\\] { font-size: calc(8px * 1.08) !important; }
        .tech-font-wrapper .text-\\[9px\\] { font-size: calc(9px * 1.08) !important; }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #0f172a;
        }
        ::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #3b82f6;
        }

        .bella-spa-hero-btn {
          background-color: #ffffff !important;
          color: #dc2626 !important;
        }
        .bella-spa-hero-btn:hover {
          background-color: #fee2e2 !important;
          color: #b91c1c !important;
        }
      `}} />

      <div
        ref={containerRef}
        className="tech-font-wrapper min-h-screen text-slate-200 relative overflow-x-hidden font-sans selection:bg-blue-600 selection:text-white"
        style={{background: '#0a0f1e'}}
      >

        {/* Dynamic mouse glow */}
        <div
          className="pointer-events-none fixed inset-0 transition duration-300 -z-10"
          style={{
            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59,130,246,0.06), transparent 80%)`
          }}
        />

        {/* Ambient glow blobs */}
        <div className="fixed top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full opacity-20 blur-[120px] pointer-events-none -z-10" style={{background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)'}} />
        <div className="fixed top-[50%] right-[-10%] w-[50vw] h-[50vw] rounded-full opacity-10 blur-[100px] pointer-events-none -z-10" style={{background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)'}} />

        {/* Global dark grid overlay */}
        <div className="fixed inset-0 pointer-events-none -z-10" style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '4rem 4rem'}} />

        {/* ── HEADER & NAVIGATION (White Capsule — always readable) ── */}
        <header className="fixed top-5 left-1/2 -translate-x-1/2 w-[92%] max-w-7xl z-50 transition-all duration-500">
          <div className={`w-full rounded-full transition-all duration-500 border px-6 py-2 flex items-center justify-between ${scrolled || mobileMenuOpen
              ? 'bg-white/95 backdrop-blur-2xl border-slate-200 shadow-[0_12px_40px_rgba(0,0,0,0.12)]'
              : 'bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.08)]'
            }`}>
            {/* Logo */}
            <Link href="/" className="flex items-center group">
              <img
                src="/FullLogo_Transparent_NoBuffer.png?v=3"
                alt="Bella AI Platform Logo"
                width={150}
                height={42}
                className="h-9 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              <a href="#core-features" className="text-[10px] font-bold text-slate-600 hover:text-blue-600 transition-colors uppercase tracking-wider">Mô hình lõi</a>
              <a href="#workspace-preview" className="text-[10px] font-bold text-slate-600 hover:text-blue-600 transition-colors uppercase tracking-wider">Hệ thống</a>
              <a href="#solutions-grid" className="text-[10px] font-bold text-slate-600 hover:text-blue-600 transition-colors uppercase tracking-wider">Trụ cột</a>
              <a href="#security-rls" className="text-[10px] font-bold text-slate-600 hover:text-blue-600 transition-colors uppercase tracking-wider">Bảo mật</a>
              <a href="#ecosystem-verticals" className="text-[10px] font-bold text-slate-600 hover:text-blue-600 transition-colors uppercase tracking-wider">Hệ sinh thái</a>
            </nav>

            {/* Header Action buttons */}
            <div className="hidden lg:flex items-center gap-3">
              <Link
                href="/bellaspa"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-full font-bold text-[9px] uppercase tracking-wider transition-all border border-slate-200 active:scale-95 flex items-center gap-1.5"
              >
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
                Phân hệ Bella Spa
              </Link>
              <Link
                href="/login"
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-full font-black text-[9px] uppercase tracking-wider transition-all active:scale-95 shadow-[0_4px_16px_rgba(37,99,235,0.3)] flex items-center gap-1.5"
              >
                Đăng Nhập
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Mobile menu toggle */}
            <button className="lg:hidden text-slate-600 hover:text-slate-900 p-1 transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile menu panel */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="w-full bg-white/98 backdrop-blur-2xl border border-slate-200 rounded-[2rem] p-6 shadow-2xl mt-3 flex flex-col gap-5 lg:hidden text-left"
              >
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
                  <a href="#core-features" onClick={() => setMobileMenuOpen(false)} className="text-xs font-bold text-slate-700 hover:text-blue-600 py-1 transition-colors uppercase tracking-wider">Mô hình lõi</a>
                  <a href="#workspace-preview" onClick={() => setMobileMenuOpen(false)} className="text-xs font-bold text-slate-700 hover:text-blue-600 py-1 transition-colors uppercase tracking-wider">Hệ thống</a>
                  <a href="#solutions-grid" onClick={() => setMobileMenuOpen(false)} className="text-xs font-bold text-slate-700 hover:text-blue-600 py-1 transition-colors uppercase tracking-wider">Trụ cột</a>
                  <a href="#security-rls" onClick={() => setMobileMenuOpen(false)} className="text-xs font-bold text-slate-700 hover:text-blue-600 py-1 transition-colors uppercase tracking-wider">Bảo mật</a>
                  <a href="#ecosystem-verticals" onClick={() => setMobileMenuOpen(false)} className="text-xs font-bold text-slate-700 hover:text-blue-600 py-1 transition-colors uppercase tracking-wider">Hệ sinh thái</a>
                </div>
                <div className="flex flex-col gap-3">
                  <Link
                    href="/bellaspa"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 w-full py-3 bg-slate-100 border border-slate-200 text-slate-700 rounded-full font-bold text-xs uppercase tracking-wider"
                  >
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                    Phân hệ Bella Spa
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30"
                  >
                    <LogIn className="w-4 h-4" />
                    Đăng Nhập
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <div className="dark">
        {/* ── HERO SECTION (Dark Tech with Banner.png Backdrop) ── */}
        <section className="relative pt-44 pb-8 flex flex-col justify-between min-h-screen overflow-hidden">

          {/* Background cityscape banner - darken overlay for dark mode */}
          <div className="absolute inset-0 z-0 w-full h-full overflow-hidden pointer-events-none hidden lg:block">
            <Image
              src="/Banner.png"
              alt="Bella EIP Tech Skyline Rocket Backdrop"
              fill
              priority
              sizes="100vw"
              className="object-cover object-right opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f1e] via-[#0a0f1e]/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0a0f1e]" />
          </div>

          {/* Main Grid Row */}
          <div className="flex-1 flex items-center w-full relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

                <div className="lg:col-span-7 flex flex-col items-start text-left space-y-8 max-w-2xl">

                  {/* Tech Pill Badge */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="inline-flex items-center gap-2.5 px-4.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-widest"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    SYSTEM PROTOCOL: OPERATIONAL INTEGRITY
                  </motion.div>

                  {/* Giant Title Typography */}
                  <div className="space-y-4 text-left">
                    <motion.h1
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className="text-5xl sm:text-7xl lg:text-[86px] font-black tracking-tight leading-[1.03]"
                      style={{color: '#ffffff'}}
                    >
                      Bella EIP
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                      className="text-lg sm:text-2xl font-bold tracking-wide uppercase bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400 bg-clip-text text-transparent"
                    >
                      Hệ Điều Hành Thông Minh Cho Chuỗi Dịch Vụ
                    </motion.p>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-slate-200 placeholder:text-slate-500 text-sm font-semibold leading-relaxed text-left max-w-xl"
                  >
                    <p>
                      Bella EIP hỗ trợ vận hành các chuỗi dịch vụ đa phân hệ quy mô lớn.
                      Hệ thống tự động hóa quy trình đặt lịch, phân bổ và tính toán hoa hồng kỹ thuật viên,
                      đảm bảo dữ liệu lương bất biến và trích xuất báo cáo P&amp;L theo dòng tiền thực thu.
                    </p>
                  </motion.div>

                  {/* CTA Row */}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="flex flex-wrap items-center gap-4 pt-2"
                  >
                    <Link
                      href="/login"
                      className="px-9 py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-full font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-[0_10px_30px_rgba(59,130,246,0.4)] flex items-center gap-2 group"
                    >
                      Khởi chạy hệ thống
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                      href="/bellaspa"
                      className="bella-spa-hero-btn px-7 py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-red-600/10"
                    >
                      Phân hệ Bella Spa
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </motion.div>

                  {/* Mobile-only banner */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.32 }}
                    className="relative w-full h-52 sm:h-72 md:h-96 rounded-3xl overflow-hidden border border-white/10 shadow-2xl lg:hidden my-6"
                    style={{background: 'rgba(15,23,42,0.8)'}}
                  >
                    <Image
                      src="/Banner.png"
                      alt="Bella EIP Tech Skyline Rocket Backdrop"
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover object-right opacity-30"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e]/80 via-transparent to-transparent" />
                  </motion.div>

                </div>
                <div className="lg:col-span-5 hidden lg:block" />
              </div>
            </div>
          </div>

          {/* Bottom Stats Bar */}
          <div className="w-full relative z-10 mt-auto pb-4 pt-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.35 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-left max-w-3xl"
              >
                {[{icon: <Database className="w-5 h-5" />, value: '99.9%', label: 'Độ chính xác số liệu', color: 'blue'}, {icon: <Activity className="w-5 h-5" />, value: '100K+', label: 'Ca làm hoàn tất', color: 'violet'}, {icon: <Percent className="w-5 h-5" />, value: '0%', label: 'Lỗi tính hoa hồng', color: 'emerald'}].map(({icon, value, label, color}) => (
                  <div key={label} className="rounded-2xl p-5 flex items-center gap-4 border border-white/10" style={{background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)'}}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color === 'blue' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : color === 'violet' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                      {icon}
                    </div>
                    <div>
                      <span className="text-[17px] font-black text-white block leading-none">{value}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 block">{label}</span>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── INTERACTIVE WORKSPACE PREVIEW (Dark Console Panel) ── */}
        <section id="workspace-preview" className="py-24 relative border-t border-white/5 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-10" style={{background: 'radial-gradient(ellipse, #3b82f6 0%, transparent 70%)'}} />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="text-center max-w-3xl mx-auto space-y-5 mb-16">
              <span className="inline-flex items-center gap-2 text-xs font-black tracking-widest uppercase px-4 py-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Trực Quan Hóa Quản Trị
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                <span className="text-white">Hệ Thống Phân Tích</span><br/>
                <span className="text-transparent bg-clip-text" style={{backgroundImage: 'linear-gradient(90deg, #60a5fa, #34d399)'}}>& Điều Phối Thực Tế</span>
              </h2>
              <p className="text-slate-300 text-sm font-semibold leading-relaxed">
                Tích hợp toàn bộ báo cáo doanh thu thực thu, trích quỹ lương dự phòng KTV và nhật ký RLS trong một màn hình thống nhất.
              </p>
            </div>

            {/* Dark Workspace App Mock */}
            <div className="relative w-full max-w-5xl mx-auto rounded-[2rem] border border-white/10 overflow-hidden" style={{background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', boxShadow: '0 0 0 1px rgba(99,102,241,0.1), 0 40px 80px rgba(0,0,0,0.5)'}}>
              {/* Toolbar */}
              <div className="w-full px-6 py-4 border-b border-white/8 flex items-center justify-between" style={{background: 'rgba(255,255,255,0.03)'}}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4 font-mono">Bella EIP Workspace v2.0</span>
                </div>
                <div className="flex items-center gap-2 bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider font-mono">SECURE · RLS ACTIVE</span>
                </div>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[480px]">
                {/* Sidebar */}
                <div className="md:col-span-3 border-r border-white/8 p-5 space-y-5 text-left" style={{background: 'rgba(255,255,255,0.02)'}}>
                  <div className="space-y-2">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Module Directory</span>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-blue-500/30 text-blue-400 font-bold text-xs" style={{background: 'rgba(59,130,246,0.1)'}}>
                        <span>AI Scheduler</span>
                        <Activity className="w-4 h-4" />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-400 hover:bg-white/5 font-semibold text-xs transition-colors">
                        <span>Decision Matrix</span>
                        <Brain className="w-4 h-4" />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-400 hover:bg-white/5 font-semibold text-xs transition-colors">
                        <span>Financial P&L</span>
                        <BarChart3 className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main panel */}
                <div className="md:col-span-9 p-8 space-y-6 text-left">
                  <div className="flex items-center justify-between pb-4 border-b border-white/8">
                    <div>
                      <h4 className="text-base font-black text-white">Bảng Quản Trị Vận Hành Hệ Thống</h4>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Core State • Live Monitor</span>
                    </div>
                    <span className="text-[10px] text-blue-400 font-black px-3 py-1 rounded-full border border-blue-500/30" style={{background: 'rgba(59,130,246,0.1)'}}>Operational Integrity</span>
                  </div>

                  {/* Micro dashboard cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-white/8 flex flex-col justify-between min-h-[90px]" style={{background: 'rgba(255,255,255,0.04)'}}>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Tổng doanh thu thực thu</span>
                      <span className="text-lg font-black text-white mt-2">428.5 Tr</span>
                    </div>
                    <div className="p-4 rounded-xl border border-white/8 flex flex-col justify-between min-h-[90px]" style={{background: 'rgba(255,255,255,0.04)'}}>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Quỹ lương KTV dự phòng</span>
                      <span className="text-lg font-black text-white mt-2">142.8 Tr</span>
                    </div>
                    <div className="p-4 rounded-xl border border-emerald-500/20 flex flex-col justify-between min-h-[90px]" style={{background: 'rgba(52,211,153,0.06)'}}>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Độ Lệch Hệ Thống</span>
                      <span className="text-lg font-black text-emerald-400 mt-2">0% Lệch</span>
                    </div>
                  </div>

                  {/* Terminal */}
                  <div className="p-5 rounded-2xl border border-white/8 font-mono text-[9px] space-y-2 text-slate-300" style={{background: 'rgba(0,0,0,0.4)'}}>
                    <p className="text-slate-500">[INFO] Initializing recalculateAndSaveSalaryRecord Engine...</p>
                    <p className="text-blue-400">[QUERY] Fetching completed service items: status = &apos;completed&apos; (Approved/Paid only)</p>
                    <p className="text-emerald-400">[SUCCESS] RLS context verified. 0 silent failures detected. Financial integrity locked.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CORE FEATURES Tab Showcase (Interactive Layout) ── */}
        <section id="core-features" className="py-32 relative border-t border-slate-800/60 overflow-hidden" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0c1a3a 70%, #0f172a 100%)'}}>
          {/* Ambient glow blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full opacity-20" style={{background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)'}} />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-15" style={{background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)'}} />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">

            <div className="text-center max-w-3xl mx-auto space-y-5 mb-16">
              <span className="inline-flex items-center gap-2 text-xs font-black tracking-widest uppercase px-4 py-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Mô Hình Vận Hành Lõi
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                <span className="text-white">Quy Trình Tự Động Hóa</span><br/>
                <span className="text-transparent bg-clip-text" style={{backgroundImage: 'linear-gradient(90deg, #60a5fa, #a78bfa)'}}>Thực Tế</span>
              </h2>
              <p className="text-slate-300 text-sm font-semibold leading-relaxed max-w-xl mx-auto">
                Tự động hóa hoàn toàn quy trình xếp lịch, phân bổ ca phục vụ kỹ thuật viên và kế toán đối soát kỳ lương.
              </p>
            </div>

            {/* Interactive Control Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
              <button
                onClick={() => setActiveTab('scheduler')}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${activeTab === 'scheduler'
                    ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/40 scale-105'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20'
                  }`}
              >
                <Cpu className="w-4 h-4" />
                Điều Phối AI COO
              </button>
              <button
                onClick={() => setActiveTab('decision')}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${activeTab === 'decision'
                    ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/40 scale-105'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20'
                  }`}
              >
                <Brain className="w-4 h-4" />
                Động Cơ Tính Lương
              </button>
              <button
                onClick={() => setActiveTab('finance')}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${activeTab === 'finance'
                    ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/40 scale-105'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20'
                  }`}
              >
                <BarChart3 className="w-4 h-4" />
                Quản Trị Tài Chính
              </button>
            </div>

            {/* Active tab contents */}
            <div className="relative rounded-[2.5rem] p-8 sm:p-12 min-h-[420px] flex items-center border border-white/10" style={{background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)', boxShadow: '0 0 0 1px rgba(99,102,241,0.15), 0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)'}}>
              <AnimatePresence mode="wait">
                {activeTab === 'scheduler' && (
                  <motion.div
                    key="scheduler"
                    variants={tabVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full"
                  >
                    <div className="lg:col-span-7 space-y-6 text-left">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 mb-1">
                        <Cpu className="w-3 h-3" /> AI COO Engine
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">Điều phối & Sắp xếp<br/>thông minh</h3>
                      <p className="text-slate-300 text-sm font-semibold leading-relaxed">
                        Động cơ tự động phân bổ ca làm việc, thời gian phục vụ, và lộ trình di chuyển của kỹ thuật viên tối ưu theo thời gian thực. Giảm thiểu tối đa tình trạng xung đột hoặc trùng lịch hẹn.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {["Phân bổ ca tự động theo tọa độ thực tế", "Tự động cảnh báo quá tải kỹ thuật viên", "Theo dõi trạng thái di chuyển KTV", "Đồng bộ lịch hẹn đa kênh thời gian thực"].map((item) => (
                          <div key={item} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
                            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                            <span className="text-xs text-slate-300 font-semibold">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="lg:col-span-5 rounded-2xl p-5 border border-white/10 space-y-3 text-left" style={{background: 'rgba(255,255,255,0.05)'}}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Trạng thái kỹ thuật viên</span>
                        <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-3.5 rounded-xl border border-white/10" style={{background: 'rgba(255,255,255,0.06)'}}>
                          <span className="text-xs font-bold text-white">KTV Nguyễn Thùy Trang</span>
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg font-black border border-emerald-500/30">Đang phục vụ</span>
                        </div>
                        <div className="flex justify-between items-center p-3.5 rounded-xl border border-white/10" style={{background: 'rgba(255,255,255,0.06)'}}>
                          <span className="text-xs font-bold text-white">KTV Phạm Minh Ánh</span>
                          <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-lg font-black border border-blue-500/30">Đang di chuyển</span>
                        </div>
                        <div className="flex justify-between items-center p-3.5 rounded-xl border border-white/10" style={{background: 'rgba(255,255,255,0.06)'}}>
                          <span className="text-xs font-bold text-white">KTV Lê Thị Hoa</span>
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg font-black border border-amber-500/30">Chờ xác nhận</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'decision' && (
                  <motion.div
                    key="decision"
                    variants={tabVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full"
                  >
                    <div className="lg:col-span-7 space-y-6 text-left">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30 mb-1">
                        <Brain className="w-3 h-3" /> Salary Engine v3
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">Động cơ tính Lương<br/>& Hoa hồng minh bạch</h3>
                      <p className="text-slate-300 text-sm font-semibold leading-relaxed">
                        Quy tắc tính toán hoa hồng chặt chẽ thừa kế cấu trúc đa cấp bậc. Đảm bảo dữ liệu lương của nhân viên/KTV minh bạch và đồng bộ theo thời gian thực từ dữ liệu chấm công chuyên cần và KPI records.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {["Hệ số nhân ca làm dựa trên gói VIP/Hạnh Phúc", "Tính pro-rata lương cơ bản theo ngày công thực tế", "Tự động đồng bộ KPI & phạt chuyên cần từ log", "Khóa kỳ lương bất biến (Month-end close) bảo mật"].map((item) => (
                          <div key={item} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
                            <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                            <span className="text-xs text-slate-300 font-semibold">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="lg:col-span-5 rounded-2xl p-5 border border-white/10 space-y-3.5 text-left font-mono text-xs" style={{background: 'rgba(255,255,255,0.05)'}}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">Phiếu tính lương chi tiết</span>
                        <span className="text-[9px] text-violet-400 font-black border border-violet-500/30 px-2 py-0.5 rounded-full bg-violet-500/10">AUTO-CALC</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between border-b border-white/10 pb-2">
                          <span className="text-slate-400">Lương cơ bản (22 ngày):</span>
                          <span className="text-white font-bold">5.800.000đ</span>
                        </div>
                        <div className="flex justify-between border-b border-white/10 pb-2">
                          <span className="text-slate-400">Hoa hồng ca làm (VIP x2):</span>
                          <span className="text-blue-400 font-bold">3.450.000đ</span>
                        </div>
                        <div className="flex justify-between border-b border-white/10 pb-2">
                          <span className="text-slate-400">KPI đồng bộ tự động:</span>
                          <span className="text-emerald-400 font-bold">+500.000đ</span>
                        </div>
                        <div className="flex justify-between pt-2 text-sm font-black rounded-xl px-3 py-2.5" style={{background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)'}}>
                          <span className="text-white">TỔNG THỰC LĨNH:</span>
                          <span className="text-violet-300">9.600.000đ</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'finance' && (
                  <motion.div
                    key="finance"
                    variants={tabVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full"
                  >
                    <div className="lg:col-span-7 space-y-6 text-left">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-1">
                        <BarChart3 className="w-3 h-3" /> P&L Intelligence
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">Tài chính chuỗi<br/>& Báo cáo P&L thực tế</h3>
                      <p className="text-slate-300 text-sm font-semibold leading-relaxed">
                        Phân tích sâu kết quả kinh doanh dòng tiền thực. Chỉ ghi nhận chi phí lương kỹ thuật viên thực tế và doanh thu dịch vụ đã được xác nhận (Status: Completed) để ngăn chặn rủi ro thổi phồng kết quả.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {["Chỉ ghi nhận chi phí đã được kế toán duyệt", "Trích lập dynamic lương KTV dự phòng chính xác", "Theo dõi doanh thu thực thu theo thời gian thực", "Báo cáo P&L đa cấp độ cơ sở/chuỗi"].map((item) => (
                          <div key={item} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-xs text-slate-300 font-semibold">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="lg:col-span-5 rounded-2xl p-5 border border-white/10 space-y-4 text-left" style={{background: 'rgba(255,255,255,0.05)'}}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Báo cáo P&L chi nhánh</span>
                        <span className="text-[9px] text-emerald-400 font-black border border-emerald-500/30 px-2 py-0.5 rounded-full bg-emerald-500/10">REAL-TIME</span>
                      </div>
                      <div className="space-y-4 text-xs">
                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-slate-400">Doanh thu thuần (Thực thu)</span>
                            <span className="text-white font-black">428.5 Tr</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{background: 'rgba(255,255,255,0.1)'}}>
                            <div className="h-full rounded-full" style={{width: '100%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)'}} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-slate-400">Quỹ lương KTV dự phòng</span>
                            <span className="text-white font-black">142.8 Tr</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{background: 'rgba(255,255,255,0.1)'}}>
                            <div className="h-full rounded-full" style={{width: '33%', background: 'linear-gradient(90deg, #f43f5e, #fb7185)'}} />
                          </div>
                        </div>
                        <div className="pt-1 border-t border-white/10">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Lợi nhuận gộp ước tính</span>
                            <span className="text-emerald-400 font-black">285.7 Tr</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </section>

        {/* ── SOLUTIONS GRID (Dark Glassmorphic Cards) ── */}
        <section id="solutions-grid" className="py-32 relative border-t border-white/5 overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -bottom-20 left-1/3 w-[500px] h-[500px] rounded-full opacity-10" style={{background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)'}} />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">

            <div className="text-center max-w-3xl mx-auto space-y-5 mb-16">
              <span className="inline-flex items-center gap-2 text-xs font-black tracking-widest uppercase px-4 py-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-400">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                Trụ Cột Hệ Thống
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                <span className="text-white">4 Giải Pháp</span><br/>
                <span className="text-transparent bg-clip-text" style={{backgroundImage: 'linear-gradient(90deg, #a78bfa, #60a5fa)'}}>Quản Trị Hiệu Quả</span>
              </h2>
              <p className="text-slate-300 text-sm font-semibold leading-relaxed">
                Từng mô-đun được xây dựng tuân thủ nghiêm ngặt các quy tắc an toàn dữ liệu và tối ưu hiệu suất dòng tiền.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {icon: <Cpu className="w-5 h-5" />, label: 'AI COO Engine', title: 'Động Cơ Điều Phối AI COO', desc: 'Tự động phân bổ ca làm việc của KTV tối ưu địa lý và công suất phục vụ thực tế của các cơ sở.', color: 'blue'},
                {icon: <Workflow className="w-5 h-5" />, label: 'Auto Workflow', title: 'Quy Trình Tự Động Hóa', desc: 'Xây dựng và kiểm soát chuỗi công việc tự động từ lúc tiếp nhận đến khi xuất hóa đơn và trích hoa hồng.', color: 'violet'},
                {icon: <Brain className="w-5 h-5" />, label: 'Salary Engine', title: 'Động Cơ Quyết Định Lương', desc: 'Tự động áp dụng hoa hồng theo phân hạng ca dịch vụ, đảm bảo chuẩn xác không nuốt lỗi dữ liệu.', color: 'indigo'},
                {icon: <BarChart3 className="w-5 h-5" />, label: 'P&L Intelligence', title: 'Báo Cáo P&L Thông Minh', desc: 'Phân tích sâu cơ cấu chi phí, dòng tiền thực thu và doanh thu thực tế của chuỗi cửa hàng dịch vụ.', color: 'emerald'},
              ].map(({icon, label, title, desc, color}) => (
                <div key={title} className="group relative p-6 rounded-3xl border border-white/8 flex flex-col justify-between min-h-[240px] text-left hover:border-white/20 hover:-translate-y-1.5 transition-all duration-300" style={{background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)'}}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color === 'blue' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : color === 'violet' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : color === 'indigo' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                    {icon}
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${color === 'blue' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : color === 'violet' ? 'border-violet-500/30 text-violet-400 bg-violet-500/10' : color === 'indigo' ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10' : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'}`}>{label}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white mb-2">{title}</h4>
                    <p className="text-slate-400 text-[10px] font-semibold leading-relaxed group-hover:text-slate-200 transition-colors">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECURITY GOVERNANCE (Dark RLS & Safety) ── */}
        <section id="security-rls" className="py-32 relative overflow-hidden border-t border-white/5">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 right-1/4 w-[600px] h-[400px] rounded-full opacity-10" style={{background: 'radial-gradient(ellipse, #10b981 0%, transparent 70%)'}} />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="rounded-[2.5rem] p-8 sm:p-14 flex flex-col lg:flex-row items-center gap-12 border border-white/10" style={{background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', boxShadow: '0 0 0 1px rgba(16,185,129,0.08), 0 40px 80px rgba(0,0,0,0.4)'}}>
              <div className="lg:w-1/2 space-y-6 text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5" />
                  Bảo Mật Cơ Sở Dữ Liệu Enterprise
                </div>
                <h3 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                  <span className="text-white">Đảm Bảo An Toàn</span><br/>
                  <span className="text-transparent bg-clip-text" style={{backgroundImage: 'linear-gradient(90deg, #34d399, #60a5fa)'}}>Thông Tin Doanh Nghiệp</span>
                </h3>
                <p className="text-slate-300 text-sm font-semibold leading-relaxed">
                  Từng dữ liệu tài chính nhạy cảm được cách ly độc lập giữa các chi nhánh hoặc chuỗi bằng Row Level Security (RLS) ở mức cơ sở dữ liệu. Ngăn chặn triệt để mọi hành vi sửa đổi dữ liệu kỳ lương lịch sử một khi đã được chốt (finalized).
                </p>
                <div className="space-y-3">
                  {['Không có lỗi nuốt ngoại lệ cơ sở dữ liệu (Zero silent DB failures).', 'Bất biến dữ liệu tài chính lương đã khóa kỳ (Month-end close).', 'Nhật ký log kiểm toán bất biến (Audit Trail) ghi lại mọi thay đổi nhạy cảm.'].map(item => (
                    <div key={item} className="flex gap-3 items-center bg-white/5 rounded-xl px-4 py-2.5 border border-white/8">
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:w-1/2 w-full grid grid-cols-2 gap-4">
                {[{icon: <ShieldCheck className="w-5 h-5" />, title: 'Supabase RLS', desc: 'Cách ly dữ liệu an toàn giữa các tenant ở cấp độ cơ sở dữ liệu.', color: 'emerald'}, {icon: <Database className="w-5 h-5" />, title: 'Bất Biến Dữ Liệu', desc: 'Khóa chặt dữ liệu kỳ lương lịch sử ngăn thay đổi ngoài ý muốn.', color: 'blue'}].map(({icon, title, desc, color}) => (
                  <div key={title} className="p-6 rounded-3xl border border-white/10 flex flex-col justify-between aspect-square text-left hover:border-white/20 transition-all hover:-translate-y-1" style={{background: 'rgba(255,255,255,0.04)'}}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                      {icon}
                    </div>
                    <div>
                      <h6 className="text-sm font-black text-white">{title}</h6>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-normal">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── ECOSYSTEM EXPANSION (Bella AI Platform Vertical Modules) ── */}
        <section id="ecosystem-verticals" className="py-32 relative border-t border-white/5 overflow-hidden" style={{background: 'linear-gradient(180deg, #0a0f1e 0%, #0c1a3a 50%, #0a0f1e 100%)'}}>
          {/* Subtle background glow */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full opacity-10" style={{background: 'radial-gradient(ellipse, #3b82f6 0%, transparent 70%)'}} />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="text-center max-w-3xl mx-auto space-y-5 mb-16">
              <span className="inline-flex items-center gap-2 text-xs font-black tracking-widest uppercase px-4 py-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-300">
                <Sparkles className="w-3.5 h-3.5" />
                Bella AI Platform
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                <span className="text-white">Hệ Sinh Thái Phân Hệ Ngành</span><br/>
                <span className="text-transparent bg-clip-text" style={{backgroundImage: 'linear-gradient(90deg, #60a5fa, #a78bfa)'}}>Mở Rộng Hệ Thống</span>
              </h2>
              <p className="text-slate-300 text-sm font-semibold leading-relaxed">
                Khám phá các phân hệ ngành mới sẵn sàng vận hành và lộ trình mở rộng toàn diện năm 2027 trên nền tảng Bella EIP.
              </p>
            </div>

            {/* Split Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Left Side: Highlighted Real Estate Module */}
              <div className="lg:col-span-4 group relative p-8 rounded-[2rem] border border-blue-500/30 flex flex-col justify-between text-left transition-all duration-300 hover:border-blue-400 hover:-translate-y-1.5 hover:shadow-[0_12px_40px_rgba(59,130,246,0.15)]" style={{background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(255,255,255,0.02) 100%)', backdropFilter: 'blur(12px)'}}>
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      <Database className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 flex items-center gap-1.5 animate-pulse">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đã Sẵn Sàng
                    </span>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest font-mono">PHÂN HỆ SỐ 01</span>
                    <h3 className="text-2xl font-black text-white tracking-tight">Real Estate</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Đã hoàn thành phân hệ quản trị ✅</p>
                  </div>
                  <p className="text-slate-300 text-xs font-semibold leading-relaxed">
                    Phân hệ quản trị Bất động sản đã hoàn thành toàn diện. Tích hợp quản lý dự án BĐS, bảng hàng căn hộ, hợp đồng & đặt cọc, chăm sóc khách hàng đầu tư và tự động hóa quy trình phân bổ Lead/SLA.
                  </p>
                  <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-white/10 group-hover:border-blue-500/30 transition-all duration-500">
                    <Image
                      src="/real_estate_preview.png"
                      alt="Bella EIP Real Estate Dashboard Render"
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e]/80 via-transparent to-transparent" />
                  </div>
                </div>
                <div className="mt-8 pt-5 border-t border-white/5 flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Ready to deploy</span>
                  <Link href="/login" className="flex items-center gap-1 text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors group/link">
                    Truy cập quản trị
                    <ArrowUpRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Right Side: 9 Coming Soon Modules in 3x3 Grid */}
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { num: '2️⃣', title: 'Automotive', desc: 'Showroom & Đại lý ô tô', emoji: '🚗' },
                  { num: '3️⃣', title: 'Furniture & Smart Home', desc: 'Nội thất & Smart Home', emoji: '🛋️' },
                  { num: '4️⃣', title: 'Industrial Equipment', desc: 'Thiết bị công nghiệp', emoji: '🏗️' },
                  { num: '5️⃣', title: 'Construction Machinery', desc: 'Máy móc công trình', emoji: '🚜' },
                  { num: '6️⃣', title: 'F&B', desc: 'Chuỗi nhà hàng, Cafe, Trà sữa', emoji: '🍽️' },
                  { num: '7️⃣', title: 'Retail Chain', desc: 'Chuỗi bán lẻ', emoji: '🛍️' },
                  { num: '8️⃣', title: 'Distribution / Wholesale', desc: 'Phân phối & Bán sỉ', emoji: '🏪' },
                  { num: '9️⃣', title: 'Hospitality', desc: 'Khách sạn & Resort', emoji: '🏨' },
                  { num: '🔟', title: 'Logistics', desc: 'Vận tải & Kho bãi', emoji: '🚚' },
                ].map(({num, title, desc, emoji}) => (
                  <div key={title} className="group relative p-5 rounded-2xl border border-white/5 flex flex-col justify-between min-h-[140px] text-left hover:border-white/10 hover:-translate-y-0.5 transition-all duration-300" style={{background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(12px)'}}>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xl">{emoji}</span>
                        <span className="text-[7px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-violet-500/20 text-violet-400 bg-violet-500/5">
                          Soon 2027
                        </span>
                      </div>
                      <h4 className="text-[11px] font-black text-white leading-tight">{num} {title}</h4>
                      <p className="text-slate-400 text-[9px] font-semibold leading-normal group-hover:text-slate-300 transition-colors">{desc}</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono">Coming Soon</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500/20 group-hover:bg-violet-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CONSULTATION REGISTRATION FORM ── */}
        <section className="py-24 relative overflow-hidden border-t border-white/5">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-15" style={{background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)'}} />
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center space-y-8">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 text-xs font-black tracking-widest uppercase px-4 py-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Đăng ký trải nghiệm
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                <span className="text-white">Khởi Đầu Quản Trị</span><br/>
                <span className="text-transparent bg-clip-text" style={{backgroundImage: 'linear-gradient(90deg, #60a5fa, #a78bfa)'}}>Vận Hành Hiện Đại</span>
              </h2>
              <p className="text-slate-300 text-sm font-semibold leading-relaxed max-w-2xl mx-auto">
                Nhập thông tin bên dưới để được đội ngũ chuyên viên liên hệ tư vấn giải pháp quản lý tối ưu phù hợp nhất với mô hình của bạn.
              </p>
            </div>

            <div className="p-6 sm:p-10 rounded-[2.5rem] text-left max-w-xl mx-auto border border-white/10" style={{background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', boxShadow: '0 0 0 1px rgba(99,102,241,0.1), 0 40px 80px rgba(0,0,0,0.4)'}}>
              <form onSubmit={handleContactSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Họ và tên của bạn</label>
                  <input
                    type="text"
                    required
                    className="block w-full px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all outline-none font-semibold text-white text-xs border border-white/10 placeholder:text-slate-400/60"
                    style={{background: 'rgba(255,255,255,0.06)'}}
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Số điện thoại liên hệ</label>
                    <input
                      type="tel"
                      required
                      className="block w-full px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all outline-none font-semibold text-white text-xs border border-white/10 placeholder:text-slate-400/60"
                      style={{background: 'rgba(255,255,255,0.06)'}}
                      placeholder="09xxxxxxxx"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phân hệ doanh nghiệp</label>
                    <select
                      required
                      className="block w-full px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/50 transition-all outline-none font-semibold text-white text-xs border border-white/10"
                      style={{background: 'rgba(255,255,255,0.06)'}}
                    >
                      <option value="spa" style={{background: '#1e293b'}}>Spa & Beauty Clinic</option>
                      <option value="fitness" style={{background: '#1e293b'}}>Fitness & Gym Center</option>
                      <option value="homecare" style={{background: '#1e293b'}}>Chăm sóc sức khỏe gia đình (Mẹ & Bé)</option>
                      <option value="academy" style={{background: '#1e293b'}}>Học viện & Đào tạo nghề</option>
                      <option value="other" style={{background: '#1e293b'}}>Dịch vụ chuỗi/Khác</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black py-4 rounded-xl active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 mt-2"
                  style={{boxShadow: '0 8px 30px rgba(59,130,246,0.35)'}}
                >
                  Gửi thông tin liên hệ
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="relative pt-20 pb-10 border-t border-white/8" style={{background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)'}}>
          {/* Footer glow */}
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[1px]" style={{background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)'}} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 pb-16 border-b border-white/8">

              {/* Brand block */}
              <div className="space-y-6 text-left">
                <div className="flex items-center gap-3">
                  <img
                    src="/FullLogo_Transparent_NoBuffer.png?v=3"
                    alt="Bella AI Platform Logo"
                    width={130}
                    height={36}
                    className="h-8.5 w-auto object-contain brightness-0 invert opacity-80"
                  />
                </div>
                <p className="text-xs font-semibold leading-relaxed text-slate-400">
                  Giải pháp quản trị vận hành chuỗi dịch vụ thế hệ mới, tích hợp động cơ tính toán và bảo mật tài chính tối ưu.
                </p>
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  System Operational
                </div>
              </div>

              {/* Column 2 */}
              <div className="space-y-4 text-left">
                <h5 className="text-xs font-black text-white/80 uppercase tracking-widest">Phân hệ EIP</h5>
                <ul className="space-y-2.5 text-xs font-semibold text-slate-400">
                  <li><Link href="/bellaspa" className="hover:text-white transition-colors">Bella Spa Mẹ & Bé</Link></li>
                  <li><a href="#" className="hover:text-white transition-colors">Bella Clinic & Y khoa</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Bella Fitness & Gym</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Học viện Đào tạo</a></li>
                </ul>
              </div>

              {/* Column 3 */}
              <div className="space-y-4 text-left">
                <h5 className="text-xs font-black text-white/80 uppercase tracking-widest">Hệ thống</h5>
                <ul className="space-y-2.5 text-xs font-semibold text-slate-400">
                  <li><a href="#" className="hover:text-white transition-colors">Tài liệu API</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Bảo mật RLS</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Chính sách Bảo mật</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Điều khoản dịch vụ</a></li>
                </ul>
              </div>

              {/* Column 4 */}
              <div className="space-y-4 text-left">
                <h5 className="text-xs font-black text-white/80 uppercase tracking-widest">Bản quyền</h5>
                <p className="text-xs font-semibold leading-relaxed text-slate-400">
                  © 2026 Bella EIP. Bảo lưu mọi quyền. Động cơ lõi được vận hành bảo mật trên nền tảng Supabase RLS.
                </p>
              </div>

            </div>

            <div className="pt-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-400">
              <span>Thiết kế theo chuẩn SaaS tương lai của Bella EIP Group</span>
              <div className="flex gap-4">
                <a href="#" className="hover:text-white transition-colors">Facebook</a>
                <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
                <a href="#" className="hover:text-white transition-colors">GitHub</a>
              </div>
            </div>
          </div>
        </footer>

        </div>
      </div>
    </>
  );
}
