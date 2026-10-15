'use client';

import { getCurrentUser } from '@/services/user-actions';
import { getModuleGuides, GuideListItem, isManualPermitted } from '@/services/user-manuals-utils';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bookmark,
  HelpCircle,
  Loader2,
  Search,
  Sparkles,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTenantName } from '@/hooks/useTenantName';

export default function UserManualsHub() {
  const { tenantName } = useTenantName();
  const { tenantModuleKey } = useTenantModuleKey();
  const vocab = useModuleVocabulary();
  const [guides, setGuides] = useState<GuideListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadGuides() {
      try {
        const user = await getCurrentUser();
        const role = user?.role ?? null;
        const moduleGuides = getModuleGuides(tenantModuleKey);
        setGuides(moduleGuides.filter((g) => isManualPermitted(role, g.slug)));
      } catch (err: unknown) {
        console.error('Failed to load guides:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadGuides();
  }, [tenantModuleKey]);

  const filteredGuides = guides.filter(
    (g) =>
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary animate-pulse" />
      </div>
    );
  }

  // Define dynamic style mapping based on tenantModuleKey
  const getThemeStyles = () => {
    switch (tenantModuleKey) {
      case 'bella_healthcare':
        return {
          wrapperBg: 'bg-slate-50 dark:bg-[#090d16]',
          glowTop: 'bg-teal-500/10 dark:bg-teal-900/10',
          glowBottom: 'bg-cyan-500/5 dark:bg-cyan-900/5',
          tagBg: 'bg-teal-50/80 border-teal-100 dark:bg-teal-950/20 dark:border-teal-800/30',
          tagText: 'text-teal-700 dark:text-teal-400',
          titleFont: 'font-sans font-black text-slate-900 dark:text-white',
          searchGlow: 'bg-teal-500/5 dark:bg-teal-900/5',
          searchBorder: 'border-slate-200/70 focus-within:border-teal-500/50 dark:border-slate-700 dark:focus-within:border-teal-700',
          cardBgGlow: 'bg-teal-100/20 dark:bg-teal-950/10',
          cardBorder: 'border-slate-200/60 dark:border-slate-800',
          cardHoverBorder: 'hover:border-teal-500/40 dark:hover:border-teal-700',
          cardIconBg: 'bg-teal-50 dark:bg-teal-950/40 border border-teal-100/50 dark:border-teal-900/30 text-teal-700',
          cardSubtitle: 'text-teal-700 dark:text-teal-400',
          cardTitle: 'text-slate-800 group-hover:text-teal-700 dark:text-white dark:group-hover:text-teal-400',
          cardDivider: 'border-slate-100 dark:border-slate-800',
          readLink: 'text-teal-700 dark:text-teal-400',
          emptyStateBorder: 'border-slate-200 dark:border-slate-800',
          footerBorder: 'border-slate-200/50 dark:border-slate-800/30',
          footerLink: 'text-teal-700 hover:text-teal-600 dark:text-teal-400 dark:hover:text-teal-300',
        };
      case 'beauty_spa':
      case 'babycare':
        return {
          wrapperBg: 'bg-background',
          glowTop: 'bg-primary/10',
          glowBottom: 'bg-accent/5',
          tagBg: 'bg-card border-primary/20',
          tagText: 'text-primary',
          titleFont: `${tenantModuleKey === 'babycare' ? 'font-handwriting' : 'font-serif'} text-primary`,
          searchGlow: 'bg-primary/10',
          searchBorder: 'border-border focus-within:border-primary/50',
          cardBgGlow: 'bg-primary/10',
          cardBorder: 'border-border',
          cardHoverBorder: 'hover:border-primary',
          cardIconBg: 'bg-primary/10 border border-primary/20 text-primary',
          cardSubtitle: 'text-primary',
          cardTitle: 'text-foreground group-hover:text-primary',
          cardDivider: 'border-border',
          readLink: 'text-primary',
          emptyStateBorder: 'border-border',
          footerBorder: 'border-border',
          footerLink: 'text-primary',
        };
      case 'real_estate':
        return {
          wrapperBg: 'bg-slate-50 dark:bg-[#0d0d14]',
          glowTop: 'bg-violet-500/10 dark:bg-violet-900/10',
          glowBottom: 'bg-indigo-500/5 dark:bg-indigo-900/5',
          tagBg: 'bg-violet-50/80 border-violet-100 dark:bg-violet-950/20 dark:border-violet-800/30',
          tagText: 'text-violet-700 dark:text-violet-400',
          titleFont: 'font-sans font-black text-slate-900 dark:text-white',
          searchGlow: 'bg-violet-500/5 dark:bg-violet-900/5',
          searchBorder: 'border-slate-200/70 focus-within:border-violet-500/50 dark:border-slate-700 dark:focus-within:border-violet-700',
          cardBgGlow: 'bg-violet-100/20 dark:bg-violet-950/10',
          cardBorder: 'border-slate-200/60 dark:border-slate-800',
          cardHoverBorder: 'hover:border-violet-500/40 dark:hover:border-violet-700',
          cardIconBg: 'bg-violet-50 dark:bg-violet-950/40 border border-violet-100/50 dark:border-violet-900/30 text-violet-700',
          cardSubtitle: 'text-violet-700 dark:text-violet-400',
          cardTitle: 'text-slate-800 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-400',
          cardDivider: 'border-slate-100 dark:border-slate-800',
          readLink: 'text-violet-700 dark:text-violet-400',
          emptyStateBorder: 'border-slate-200 dark:border-slate-800',
          footerBorder: 'border-slate-200/50 dark:border-slate-800/30',
          footerLink: 'text-violet-700 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300',
        };
      default: // industrial_cleaning or others
        return {
          wrapperBg: 'bg-slate-50 dark:bg-[#11100F]',
          glowTop: 'bg-slate-300/20 dark:bg-slate-900/10',
          glowBottom: 'bg-slate-200/10 dark:bg-slate-900/5',
          tagBg: 'bg-slate-100 border-slate-200 dark:bg-[#1C1B19] dark:border-[#3E3A35]',
          tagText: 'text-slate-650 dark:text-[#CDBCAB]',
          titleFont: 'font-serif text-slate-850 dark:text-[#A67D44]',
          searchGlow: 'bg-slate-500/5 dark:bg-slate-800/5',
          searchBorder: 'border-slate-200 focus-within:border-slate-400 dark:border-[#3E3A35] dark:focus-within:border-slate-700',
          cardBgGlow: 'bg-slate-100/30 dark:bg-slate-900/5',
          cardBorder: 'border-slate-200 dark:border-[#3E3A35]',
          cardHoverBorder: 'hover:border-slate-300 dark:hover:border-slate-700',
          cardIconBg: 'bg-slate-100 border border-slate-200/50 dark:border-[#3E3A35]/50 text-slate-700',
          cardSubtitle: 'text-slate-650 dark:text-[#A67D44]',
          cardTitle: 'text-slate-800 group-hover:text-slate-900 dark:text-[#EFE9E1] dark:group-hover:text-[#A67D44]',
          cardDivider: 'border-slate-100 dark:border-[#3E3A35]',
          readLink: 'text-slate-700 dark:text-[#A67D44]',
          emptyStateBorder: 'border-slate-200 dark:border-[#3E3A35]',
          footerBorder: 'border-slate-200/50 dark:border-[#3E3A35]/30',
          footerLink: 'text-slate-700 hover:text-slate-600 dark:text-[#A67D44] dark:hover:text-[#CDBCAB]',
        };
    }
  };

  const theme = getThemeStyles();

  return (
    <div className={`min-h-full py-10 px-6 lg:px-12 relative overflow-x-hidden transition-colors duration-300 ${theme.wrapperBg}`}>
      {/* Decorative Blur Background elements */}
      <div className={`absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none ${theme.glowTop}`} />
      <div className={`absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none ${theme.glowBottom}`} />

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        {/* Breadcrumbs & Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-950/5 pb-4">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
            <Link href="/dashboard" className="hover:text-primary transition-colors">
              Tổng quan
            </Link>
            <ChevronRight size={12} className="opacity-40" />
            <span className="text-primary font-bold">Hướng dẫn sử dụng</span>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-primary hover:border-primary/30 group"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
            <span>Trở về tổng quan</span>
          </Link>
        </div>

        {/* Header Section */}
        <header className="text-center max-w-3xl mx-auto space-y-4 pt-4">
          <div className={`inline-flex items-center gap-2 border px-4 py-1.5 rounded-full shadow-sm ${theme.tagBg}`}>
            <Sparkles className={`w-4 h-4 ${theme.tagText}`} />
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.tagText}`}>Trung tâm tài liệu</span>
          </div>
          
          <h1 className={`text-5xl md:text-6.5xl leading-tight font-extrabold tracking-tight ${theme.titleFont}`}>
            Sổ tay hướng dẫn
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-[#CDBCAB] leading-relaxed max-w-2xl mx-auto">
            Học quy trình SOP chuẩn hóa, quản lý nghiệp vụ tài chính, kế toán, nhân sự hoặc check-in/out {vocab.worker.singular.toLowerCase()} dành riêng cho vai trò của bạn.
          </p>
        </header>

        {/* Search Bar Block */}
        <div className="max-w-md mx-auto">
          <div className="relative group">
            <div className={`absolute inset-0 blur-xl rounded-full scale-95 opacity-50 group-hover:opacity-100 transition-opacity duration-300 ${theme.searchGlow}`} />
            <div className={`relative bg-white dark:bg-[#1C1B19] border rounded-2xl flex items-center px-4 py-3 shadow-sm focus-within:shadow transition-all duration-300 ${theme.searchBorder}`}>
              <Search className="w-5 h-5 text-slate-400 dark:text-[#CDBCAB] mr-3" />
              <input
                type="text"
                placeholder="Tìm quy trình, hướng dẫn sử dụng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-800 dark:text-[#EFE9E1] placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Bento Grid layout for guides */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {filteredGuides.length > 0 ? (
            filteredGuides.map((guide, idx) => (
              <motion.div
                key={guide.slug}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
              >
                <Link
                  href={`/dashboard/guides/${guide.slug}`}
                  className={`group block h-full bg-white dark:bg-[#1C1B19] rounded-[2rem] border p-8 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative overflow-hidden ${theme.cardBorder} ${theme.cardHoverBorder}`}
                >
                  {/* Decorative faint glow inside card */}
                  <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 ${theme.cardBgGlow}`} />
                  
                  {/* Icon section */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-105 group-hover:rotate-[-3deg] transition-all duration-300 ${theme.cardIconBg}`}>
                    {guide.icon}
                  </div>

                  <span className={`text-[10px] font-extrabold uppercase tracking-wider block mb-2 ${theme.cardSubtitle}`}>
                    {guide.subtitle}
                  </span>
                  
                  <h3 className={`text-xl font-extrabold mb-3 transition-colors leading-tight ${theme.cardTitle}`}>
                    {guide.title}
                  </h3>
                  
                  <p className="text-xs text-slate-500 dark:text-[#CDBCAB] leading-relaxed mb-6 font-medium">
                    {guide.description}
                  </p>

                  <div className={`pt-4 border-t flex items-center justify-between mt-auto ${theme.cardDivider}`}>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${theme.readLink}`}>
                      Đọc tài liệu
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                    </span>
                    <Bookmark className="w-4 h-4 text-slate-350 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              </motion.div>
            ))
          ) : (
            <div className={`col-span-full py-16 text-center bg-white dark:bg-[#1C1B19] rounded-[2rem] border ${theme.emptyStateBorder}`}>
              <HelpCircle className="w-12 h-12 text-slate-300 dark:text-[#CDBCAB] mx-auto mb-4 animate-bounce" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-[#EFE9E1]">Không tìm thấy tài liệu phù hợp</h3>
              <p className="text-xs text-slate-400 mt-1">Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc quyền hạn tài khoản của bạn.</p>
            </div>
          )}
        </div>

        {/* Footer Support Information */}
        <footer className={`text-center pt-12 border-t ${theme.footerBorder}`}>
          <p className="text-xs text-slate-400 dark:text-[#CDBCAB] font-bold uppercase tracking-widest">{tenantName || 'Bella ERP'} Group · Hỗ trợ kỹ thuật</p>
          <div className="flex justify-center gap-6 mt-4 text-xs font-bold">
            <a href="mailto:support@bella.vn" className={`hover:underline ${theme.footerLink}`}>support@bella.vn</a>
            <span className="text-slate-300">•</span>
            <a href="tel:02899999999" className={`hover:underline ${theme.footerLink}`}>(028) 9999 9999</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
