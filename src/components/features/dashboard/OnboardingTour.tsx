'use client';

import { useMemo,useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building, 
  Package, 
  Users, 
  QrCode, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Sparkles, 
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { getModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';

interface OnboardingTourProps {
  forceOpen?: boolean;
  onCloseTour?: () => void;
  brandName?: string;
  tenantModuleKey?: TenantModuleKey | null;
}

function buildSteps(brandName: string, tenantModuleKey: TenantModuleKey | null | undefined) {
  const vocab = getModuleVocabulary(tenantModuleKey);
  const isBeautySpa = tenantModuleKey === 'beauty_spa';
  const serviceDescription = isBeautySpa
    ? `Tạo các dịch vụ facial, body, công nghệ cao hoặc gói liệu trình riêng của spa; đồng thời thiết lập định mức mỹ phẩm, mask, tinh chất và vật tư tiêu hao. Khi ${vocab.worker.singular.toLowerCase()} hoàn thành ${vocab.workUnit.singular.toLowerCase()} dịch vụ, kho hàng sẽ được cập nhật theo định mức đã cấu hình.`
    : `Tạo các gói liệu trình chăm sóc cao cấp cho Mẹ và Bé, đồng thời thiết lập định mức vật tư tiêu hao như tinh dầu, khăn và dụng cụ chăm sóc. Mỗi khi ${vocab.worker.singular.toLowerCase()} hoàn thành ${vocab.workUnit.singular.toLowerCase()}, kho hàng sẽ tự động trừ hàng tương ứng theo định mức.`;
  const serviceTip = isBeautySpa
    ? 'Mẹo: Chia nhóm dịch vụ theo facial, body, công nghệ cao hoặc dưỡng sinh để lọc lịch và theo dõi hiệu suất rõ hơn.'
    : 'Mẹo: Bật cảnh báo tồn kho tối thiểu tại phần Cài đặt để nhận tin nhắn Zalo/Dashboard khi vật tư sắp hết.';
  const salaryDescription = isBeautySpa
    ? `Thêm ${vocab.worker.singular.toLowerCase()} vào hệ thống, phân vai trò chuyên môn và thiết lập hoa hồng linh hoạt theo dịch vụ, liệu trình hoặc doanh thu. ${brandName} tự động tổng hợp ${vocab.workUnit.plural.toLowerCase()} hoàn thành, đánh giá khách hàng, thưởng/phạt và dữ liệu chấm công để hỗ trợ đối soát lương hằng tháng.`
    : `Thêm ${vocab.worker.short} vào hệ thống, phân vai trò chuyên môn và thiết lập tỷ lệ hoa hồng hoặc thưởng rating. ${brandName} tự động tính điểm KPI từ đánh giá khách hàng và kỷ luật ${vocab.workUnit.singular.toLowerCase()} để tổng hợp lương thưởng hằng tháng.`;

  return [
  {
    title: 'Thiết lập Chi nhánh',
    subtitle: 'Nền tảng vận hành đa chi nhánh',
    description: 'Bắt đầu bằng việc cấu hình cơ sở vật chất và thông tin chi nhánh của bạn tại mục Cài đặt. Hệ thống hỗ trợ quản lý độc lập từng chi nhánh, phân quyền kho bãi và luồng tiền tệ riêng biệt nhưng vẫn có báo cáo hợp nhất tại cấp quản trị.',
    icon: Building,
    color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/30',
    glowColor: 'rgba(59, 130, 246, 0.15)',
    actionLabel: 'Thiết lập chi nhánh ngay',
    actionLink: '/dashboard/settings',
    tip: 'Mẹo: Bạn có thể cấu hình tài khoản ngân hàng riêng cho mỗi chi nhánh để khách chuyển khoản đặt cọc chính xác.'
  },
  {
    title: 'Quản lý Dịch vụ & Vật tư',
    subtitle: 'Tự động hóa hao phí và trừ kho',
    description: serviceDescription,
    icon: Package,
    color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/30',
    glowColor: 'rgba(244, 63, 94, 0.15)',
    actionLabel: 'Tạo dịch vụ & kho',
    actionLink: '/dashboard/inventory',
    tip: serviceTip
  },
  {
    title: `Quản lý & Tính Lương ${vocab.worker.plural}`,
    subtitle: 'Cấu hình hoa hồng và thưởng KPI linh hoạt',
    description: salaryDescription,
    icon: Users,
    color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900/30',
    glowColor: 'rgba(168, 85, 247, 0.15)',
    actionLabel: 'Cấu hình Lương',
    actionLink: '/dashboard/settings?tab=salary',
    tip: 'Mẹo: Quản trị viên có thể thay đổi mức thưởng, phạt hoặc hoa hồng trong phần cấu hình lương để phù hợp chính sách vận hành.'
  },
  {
    title: 'VietQR & Đối soát Tự động',
    subtitle: 'Thanh toán tức thì, không lo sai lệch',
    description: `Hệ thống tự động sinh mã VietQR động chứa mã lịch hẹn/dịch vụ và số tiền cần thanh toán. Khi khách hàng quét mã chuyển khoản thành công, hệ thống sẽ tự động xác nhận giao dịch và cập nhật doanh thu để đối soát nhanh hơn.`,
    icon: QrCode,
    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/30',
    glowColor: 'rgba(16, 185, 129, 0.15)',
    actionLabel: 'Trải nghiệm Booking',
    actionLink: '/dashboard/bookings',
    tip: `Mẹo: ${vocab.worker.singular} hoàn thành ${vocab.workUnit.singular.toLowerCase()} dịch vụ trễ hoặc khác chuẩn thời lượng nên ghi chú lý do để quản lý dễ đối soát chất lượng.`
  }
];
}

export default function OnboardingTour({
  forceOpen,
  onCloseTour,
  brandName = 'Spa ERP',
  tenantModuleKey,
}: OnboardingTourProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const steps = useMemo(() => buildSteps(brandName, tenantModuleKey), [brandName, tenantModuleKey]);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      setCurrentStep(0);
      return;
    }
    const completed = localStorage.getItem('bella_onboarding_completed');
    if (!completed) {
      // Auto open after a small delay for premium feels
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [forceOpen]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('bella_onboarding_completed', 'true');
    setIsOpen(false);
    if (onCloseTour) onCloseTour();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const CurrentStepIcon = steps[currentStep].icon;

  return (
    <>
      {/* Floating help trigger so users can replay the tour anytime */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setCurrentStep(0);
          }}
          className="fixed bottom-6 right-6 z-40 bg-white/90 dark:bg-primary/90 hover:bg-primary-hover hover:text-primary-foreground border border-pink-100 dark:border-slate-800 text-slate-500 p-4 rounded-full shadow-2xl flex items-center gap-2 font-black uppercase tracking-widest text-[10px] backdrop-blur-md transition-all hover:scale-105 active:scale-95 group"
          title="Xem hướng dẫn sử dụng"
        >
          <HelpCircle className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap">
            Hướng dẫn Onboarding
          </span>
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Glassmorphic backdrop blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleSkip}
              className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md"
            />

            {/* Premium Onboarding dialog container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-800/60 rounded-[3rem] shadow-2xl p-8 md:p-12 w-full max-w-2xl overflow-hidden relative z-10 flex flex-col justify-between h-auto min-h-[500px]"
              style={{
                boxShadow: `0 30px 100px -10px ${steps[currentStep].glowColor}, 0 20px 50px -15px rgba(0,0,0,0.15)`
              }}
            >
              {/* Header section */}
              <div className="flex items-center justify-between shrink-0 mb-8">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                    Bắt đầu cùng {brandName}
                  </span>
                </div>
                <button 
                  onClick={handleSkip}
                  className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center justify-center active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Steps Progress Indicator */}
              <div className="flex items-center gap-2 mb-10 shrink-0">
                {steps.map((step, idx) => (
                  <div 
                    key={idx}
                    className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 relative"
                  >
                    <motion.div 
                      className={`h-full bg-gradient-to-r ${
                        idx === 0 ? 'from-blue-500 to-indigo-500' :
                        idx === 1 ? 'from-rose-500 to-pink-500' :
                        idx === 2 ? 'from-purple-500 to-violet-500' :
                        'from-emerald-500 to-teal-500'
                      }`}
                      initial={{ width: '0%' }}
                      animate={{ width: idx <= currentStep ? '100%' : '0%' }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                ))}
              </div>

              {/* Interactive step description */}
              <div className="flex-1 flex flex-col md:flex-row gap-8 items-start mb-10">
                <div className={`w-20 h-20 rounded-3xl shrink-0 border flex items-center justify-center shadow-lg transition-all duration-500 transform hover:scale-105 hover:-rotate-3 ${steps[currentStep].color}`}>
                  <CurrentStepIcon className="w-10 h-10" />
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-primary">
                      Bước {currentStep + 1} / {steps.length}
                    </span>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1.5">
                      {steps[currentStep].title}
                    </h2>
                    <h4 className="text-sm font-bold text-slate-500 dark:text-pink-200/60 uppercase tracking-widest mt-1">
                      {steps[currentStep].subtitle}
                    </h4>
                  </div>
                  <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {steps[currentStep].description}
                  </p>
                  
                  {/* Tip alert box */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400 italic">
                    {steps[currentStep].tip}
                  </div>
                </div>
              </div>

              {/* Bottom controls panel */}
              <div className="flex items-center justify-between shrink-0 pt-4 border-t border-slate-100 dark:border-slate-800/60 gap-4">
                <button
                  onClick={handleSkip}
                  className="px-6 py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 transition-colors tracking-widest active:scale-95"
                >
                  Bỏ qua hướng dẫn
                </button>

                <div className="flex items-center gap-3">
                  {currentStep > 0 && (
                    <button
                      onClick={handleBack}
                      className="px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2 active:scale-95"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Quay lại</span>
                    </button>
                  )}

                  <button
                    onClick={handleNext}
                    className={`px-8 py-4 rounded-2xl text-white transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg active:scale-95 ${
                      currentStep === steps.length - 1
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-100 dark:shadow-none'
                        : 'bg-primary hover:bg-primary-hover shadow-primary/20 dark:shadow-none'
                    }`}
                  >
                    {currentStep === steps.length - 1 ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Hoàn thành</span>
                      </>
                    ) : (
                      <>
                        <span>Đi tiếp</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Ambient visual background glow details */}
              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-accent/5 rounded-full blur-[80px] pointer-events-none" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
