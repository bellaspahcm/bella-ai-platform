'use client';

import { getCurrentUser } from '@/services/user-actions';
import { ALL_GUIDES,isManualPermitted } from '@/services/user-manuals-utils';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import {
ChevronLeft,
Loader2,
Maximize2,
Minimize2,
Printer
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use,useEffect,useState } from 'react';
import { toast } from 'sonner';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function GuideReader({ params }: PageProps) {
  const router = useRouter();
  const { slug } = use(params);
  const { tenantModuleKey } = useTenantModuleKey();
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [guideTitle, setGuideTitle] = useState('Đang tải...');

  useEffect(() => {
    async function verifyAccess() {
      try {
        const user = await getCurrentUser();
        const role = user?.role ?? null;
        const found = ALL_GUIDES.find((g) => g.slug === slug);
        if (!found || !isManualPermitted(role, slug)) {
          toast.error('Bạn không có quyền truy cập tài liệu này.');
          router.push('/dashboard/guides');
          return;
        }
        setGuideTitle(found.title);
      } catch (err: unknown) {
        console.error('Error verifying guide access:', err);
        router.push('/dashboard/guides');
      } finally {
        setIsLoading(false);
      }
    }
    verifyAccess();
  }, [slug, router]);

  const handlePrint = () => {
    const iframe = document.getElementById('guide-frame') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      toast.error('Không thể in tài liệu vào lúc này.');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Define dynamic style mapping based on tenantModuleKey
  const getThemeStyles = () => {
    switch (tenantModuleKey) {
      case 'beauty_spa':
      case 'babycare':
        return {
          wrapperBg: 'bg-background',
          loaderColor: 'text-primary',
          navBg: 'bg-card border border-border',
          backBtnBg: 'bg-primary/10 hover:bg-primary/20 text-primary',
          headerTag: 'text-primary',
          iframeBorder: 'border border-border',
          iframeShadow: 'shadow-sm',
        };
      case 'real_estate':
        return {
          wrapperBg: 'bg-slate-50 dark:bg-[#0d0d14]',
          loaderColor: 'text-violet-700 dark:text-violet-400',
          navBg: 'bg-white/80 dark:bg-slate-900/85 border border-slate-200/70 dark:border-slate-800/80',
          backBtnBg: 'bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/40 dark:hover:bg-violet-900/60 text-violet-700 dark:text-violet-400',
          headerTag: 'text-violet-700 dark:text-violet-400',
          iframeBorder: 'border-slate-200/60 dark:border-slate-800',
          iframeShadow: 'shadow-sm',
        };
      default: // industrial_cleaning or others
        return {
          wrapperBg: 'bg-slate-50 dark:bg-[#11100F]',
          loaderColor: 'text-slate-700 dark:text-[#A67D44]',
          navBg: 'bg-white dark:bg-[#1C1B19] border border-slate-200 dark:border-[#3E3A35]',
          backBtnBg: 'bg-slate-100 hover:bg-slate-200 dark:bg-[#3E3A35] dark:hover:bg-[#4E4941] text-slate-700 dark:text-[#A67D44]',
          headerTag: 'text-slate-650 dark:text-[#A67D44]',
          iframeBorder: 'border border-slate-200 dark:border-[#3E3A35]',
          iframeShadow: 'shadow-sm',
        };
    }
  };

  const theme = getThemeStyles();

  if (isLoading) {
    return (
      <div className={`flex h-screen items-center justify-center dark:bg-[#11100F] ${theme.wrapperBg}`}>
        <Loader2 className={`w-10 h-10 animate-spin animate-pulse ${theme.loaderColor}`} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen dark:bg-[#11100F] transition-colors duration-300 ${theme.wrapperBg} ${
      isFullscreen ? 'p-0 z-50 fixed inset-0' : 'py-8 px-6 lg:px-12'
    }`}>
      <div className={`max-w-7xl mx-auto h-full flex flex-col ${
        isFullscreen ? 'h-screen max-w-full' : 'space-y-6'
      }`}>
        
        {/* Navigation / Header Bar */}
        {!isFullscreen && (
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl p-4 shadow-sm backdrop-blur-md ${theme.navBg}`}>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/guides"
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors active:scale-95 ${theme.backBtnBg}`}
              >
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <div>
                <span className={`text-[9px] font-black uppercase tracking-widest block mb-0.5 ${theme.headerTag}`}>
                  Tài liệu Hướng dẫn
                </span>
                <h1 className="text-lg font-black text-slate-800 dark:text-[#EFE9E1]">
                  {guideTitle}
                </h1>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-[#1C1B19] dark:border dark:border-[#3E3A35] text-slate-600 dark:text-[#CDBCAB] text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                title="In tài liệu hướng dẫn"
              >
                <Printer className="w-4 h-4" />
                <span>In tài liệu</span>
              </button>
              
              <button
                onClick={toggleFullscreen}
                className="w-10 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-[#1C1B19] dark:border dark:border-[#3E3A35] text-slate-600 dark:text-[#CDBCAB] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                title="Phóng to toàn màn hình"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Iframe Content Frame */}
        <div className={`relative bg-white dark:bg-[#1C1B19] transition-all duration-300 flex-grow ${theme.iframeBorder} ${theme.iframeShadow} ${
          isFullscreen 
            ? 'w-screen h-screen border-none rounded-none shadow-none' 
            : 'rounded-[2rem] overflow-hidden h-[80vh]'
        }`}>
          {isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 z-50 w-10 h-10 rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 text-white flex items-center justify-center backdrop-blur-md active:scale-95 transition-all shadow-md cursor-pointer"
              title="Thoát toàn màn hình"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          )}
          
          <iframe
            id="guide-frame"
            src={`/user-manuals/${slug}.html`}
            className="w-full h-full border-none"
          />
        </div>

      </div>
    </div>
  );
}
