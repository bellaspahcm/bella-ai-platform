'use client';

import { motion } from 'framer-motion';
import { Baby, Building2, GraduationCap, Hotel, Mail, MapPin, Paintbrush, Phone, RefreshCw, Scissors, Sparkles, User, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  HOSPITALITY_PROFILE_IDS,
  getHospitalityProfileContract,
  type HospitalityFrontDeskMode,
  type HospitalityHousekeepingCadence,
  type HospitalityMaintenancePriority,
  type HospitalityProfileId,
  type HospitalityTenantConfiguration,
} from '@/products/bella-hospitality/profile-contract';

type TenantProductKey =
  | 'bella_babycare'
  | 'bella_spa'
  | 'bella_haircut'
  | 'bella_nail'
  | 'bella_manufacturing'
  | 'bella_preschool'
  | 'bella_english_center'
  | 'bella_hospitality';

export type HqBranchRegistrationInput = {
  spaName: string;
  contactPhone: string;
  address: string;
  email: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  productKey: TenantProductKey;
  businessModule: 'babycare' | 'beauty_spa' | 'manufacturing' | 'bella_education' | 'hospitality';
  hospitality?: {
    profileId: HospitalityProfileId;
    configuration: HospitalityTenantConfiguration;
  };
};

interface HqBranchRegistrationModalProps {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: HqBranchRegistrationInput) => Promise<void>;
}

const productOptions: Array<{
  productKey: TenantProductKey;
  businessModule: HqBranchRegistrationInput['businessModule'];
  label: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  {
    productKey: 'bella_spa',
    businessModule: 'beauty_spa',
    label: 'Beauty Spa',
    description: 'Spa, liệu trình, KTV, tài nguyên phòng/giường',
    icon: Sparkles,
  },
  {
    productKey: 'bella_haircut',
    businessModule: 'beauty_spa',
    label: 'Haircut',
    description: 'Salon tóc, lịch cắt tóc, ghế/kỹ thuật viên',
    icon: Scissors,
  },
  {
    productKey: 'bella_nail',
    businessModule: 'beauty_spa',
    label: 'Nail',
    description: 'Nail studio, dịch vụ nail, booking và doanh thu',
    icon: Paintbrush,
  },
  {
    productKey: 'bella_babycare',
    businessModule: 'babycare',
    label: 'BabyCare',
    description: 'Mẹ và bé, chăm sóc sau sinh, liệu trình baby',
    icon: Baby,
  },
  {
    productKey: 'bella_preschool',
    businessModule: 'bella_education',
    label: 'Preschool',
    description: 'Trường mầm non, vận hành giáo dục',
    icon: GraduationCap,
  },
  {
    productKey: 'bella_english_center',
    businessModule: 'bella_education',
    label: 'English Center',
    description: 'Trung tâm tiếng Anh, lớp học, học phí',
    icon: GraduationCap,
  },
  {
    productKey: 'bella_hospitality',
    businessModule: 'hospitality',
    label: 'Hospitality',
    description: 'Khách sạn, homestay, lưu trú ngắn hạn',
    icon: Hotel,
  },
  {
    productKey: 'bella_manufacturing',
    businessModule: 'manufacturing',
    label: 'Bella Manufacturing',
    description: 'Quản lý sản xuất và thi công nội thất',
    icon: Building2,
  },
];

function defaultHospitalitySelection(profileId: HospitalityProfileId = 'hotel'): HqBranchRegistrationInput['hospitality'] {
  const profile = getHospitalityProfileContract(profileId);
  return {
    profileId,
    configuration: profile.defaults,
  };
}

function resolveFrontDeskMode(profileId: HospitalityProfileId, value: string): HospitalityFrontDeskMode {
  const profile = getHospitalityProfileContract(profileId);
  return profile.supportedConfiguration.frontDeskMode.find((option) => option === value)
    ?? profile.defaults.frontDeskMode;
}

function resolveHousekeepingCadence(profileId: HospitalityProfileId, value: string): HospitalityHousekeepingCadence {
  const profile = getHospitalityProfileContract(profileId);
  return profile.supportedConfiguration.housekeepingCadence.find((option) => option === value)
    ?? profile.defaults.housekeepingCadence;
}

function resolveMaintenancePriority(profileId: HospitalityProfileId, value: string): HospitalityMaintenancePriority {
  const profile = getHospitalityProfileContract(profileId);
  return profile.supportedConfiguration.maintenancePriority.find((option) => option === value)
    ?? profile.defaults.maintenancePriority;
}

const emptyForm: HqBranchRegistrationInput = {
  spaName: '',
  contactPhone: '',
  address: '',
  email: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  productKey: 'bella_spa',
  businessModule: 'beauty_spa',
};

export function HqBranchRegistrationModal({
  open,
  submitting,
  onClose,
  onSubmit,
}: HqBranchRegistrationModalProps) {
  const [form, setForm] = useState<HqBranchRegistrationInput>(emptyForm);

  if (!open) return null;

  const updateField = <K extends keyof HqBranchRegistrationInput>(
    key: K,
    value: HqBranchRegistrationInput[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectedHospitalityProfile = form.hospitality
    ? getHospitalityProfileContract(form.hospitality.profileId)
    : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 bg-slate-900/60 backdrop-blur-sm sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white text-left shadow-2xl dark:border-[#3E3A35] dark:bg-[#1C1B19] sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 px-5 py-5 text-white sm:px-8 sm:py-6">
          <div>
            <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">
              HQ TENANT ONBOARDING
            </span>
            <h3 className="text-lg font-black uppercase tracking-tight mt-1">Đăng ký tenant mới</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="m-2 min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain rounded-[2rem] p-4 pr-3 custom-scrollbar [scrollbar-gutter:stable] sm:m-3 sm:p-6 sm:pr-5">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tenant thuộc sản phẩm *</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {productOptions.map((option) => {
                const Icon = option.icon;
                const selected = form.productKey === option.productKey;
                return (
                  <button
                    key={option.productKey}
                    type="button"
                    onClick={() => {
                      setForm((current) => ({
                        ...current,
                        productKey: option.productKey,
                        businessModule: option.businessModule,
                        hospitality: option.productKey === 'bella_hospitality'
                          ? current.hospitality ?? defaultHospitalitySelection()
                          : undefined,
                      }));
                    }}
                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                      selected
                        ? 'border-primary bg-primary/5 text-primary shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                      <Icon size={15} />
                      {option.label}
                    </span>
                    <span className="mt-1 block text-[11px] font-bold leading-relaxed text-slate-400">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {form.productKey === 'bella_hospitality' && selectedHospitalityProfile ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#3E3A35] dark:bg-[#11100F]">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hospitality profile *</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {HOSPITALITY_PROFILE_IDS.map((profileId) => {
                    const profile = getHospitalityProfileContract(profileId);
                    const selected = form.hospitality?.profileId === profileId;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => updateField('hospitality', defaultHospitalitySelection(profile.id))}
                        className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                          selected
                            ? 'border-primary bg-primary/5 text-primary shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#3E3A35] dark:bg-[#1C1B19]'
                        }`}
                      >
                        <span className="text-xs font-black uppercase tracking-wider">{profile.displayName}</span>
                        <span className="mt-1 block text-[11px] font-bold leading-relaxed text-slate-400">
                          {profile.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Front desk</span>
                  <select
                    value={form.hospitality?.configuration.frontDeskMode ?? selectedHospitalityProfile.defaults.frontDeskMode}
                    onChange={(event) => updateField('hospitality', {
                      profileId: selectedHospitalityProfile.id,
                      configuration: {
                        ...selectedHospitalityProfile.defaults,
                        ...form.hospitality?.configuration,
                        frontDeskMode: resolveFrontDeskMode(selectedHospitalityProfile.id, event.target.value),
                      },
                    })}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-black outline-none focus:border-primary dark:border-[#3E3A35] dark:bg-[#1C1B19]"
                  >
                    {selectedHospitalityProfile.supportedConfiguration.frontDeskMode.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Housekeeping</span>
                  <select
                    value={form.hospitality?.configuration.housekeepingCadence ?? selectedHospitalityProfile.defaults.housekeepingCadence}
                    onChange={(event) => updateField('hospitality', {
                      profileId: selectedHospitalityProfile.id,
                      configuration: {
                        ...selectedHospitalityProfile.defaults,
                        ...form.hospitality?.configuration,
                        housekeepingCadence: resolveHousekeepingCadence(selectedHospitalityProfile.id, event.target.value),
                      },
                    })}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-black outline-none focus:border-primary dark:border-[#3E3A35] dark:bg-[#1C1B19]"
                  >
                    {selectedHospitalityProfile.supportedConfiguration.housekeepingCadence.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Maintenance</span>
                  <select
                    value={form.hospitality?.configuration.maintenancePriority ?? selectedHospitalityProfile.defaults.maintenancePriority}
                    onChange={(event) => updateField('hospitality', {
                      profileId: selectedHospitalityProfile.id,
                      configuration: {
                        ...selectedHospitalityProfile.defaults,
                        ...form.hospitality?.configuration,
                        maintenancePriority: resolveMaintenancePriority(selectedHospitalityProfile.id, event.target.value),
                      },
                    })}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-black outline-none focus:border-primary dark:border-[#3E3A35] dark:bg-[#1C1B19]"
                  >
                    {selectedHospitalityProfile.supportedConfiguration.maintenancePriority.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tên tenant *</span>
              <div className="relative">
                <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={form.spaName}
                  onChange={(event) => updateField('spaName', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary"
                  placeholder="VD: Bella Beauty Spa Quận 7"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hotline *</span>
              <div className="relative">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={form.contactPhone}
                  onChange={(event) => updateField('contactPhone', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary"
                  placeholder="0900000000"
                />
              </div>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Địa chỉ *</span>
              <div className="relative">
                <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={form.address}
                  onChange={(event) => updateField('address', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary"
                  placeholder="Địa chỉ tenant"
                />
              </div>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email tenant *</span>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary"
                  placeholder="branch@company.com"
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5 border-t border-slate-100 dark:border-[#3E3A35]">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tên admin *</span>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={form.adminName}
                  onChange={(event) => updateField('adminName', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary"
                  placeholder="Admin chi nhánh"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email admin *</span>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="email"
                  value={form.adminEmail}
                  onChange={(event) => updateField('adminEmail', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary"
                  placeholder="admin@company.com"
                />
              </div>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mật khẩu tạm thời *</span>
              <input
                required
                minLength={6}
                type="password"
                value={form.adminPassword}
                onChange={(event) => updateField('adminPassword', event.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
                placeholder="Tối thiểu 6 ký tự"
              />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t border-slate-100 dark:border-[#3E3A35]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : null}
              Tạo tenant
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
