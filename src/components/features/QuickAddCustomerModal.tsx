'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Phone, MapPin, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { createCustomer } from '@/services/customer-actions';
import { getTenantModulePresentationOrNeutral } from '@/lib/business-rules/tenant-module-presentation';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

type CustomerRow = Database['public']['Tables']['customers']['Row'];

interface QuickAddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newCustomer: CustomerRow) => void;
}

export function QuickAddCustomerModal({ isOpen, onClose, onSuccess }: QuickAddCustomerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { tenantModuleKey, refreshTenantModuleKey } = useTenantModuleKey();
  const customerLabels = getTenantModulePresentationOrNeutral(tenantModuleKey);
  const [formData, setFormData] = useState({
    name_mother: '',
    phone: '',
    address: '',
    notes: ''
  });

  useEffect(() => {
    if (!isOpen) return;
    void refreshTenantModuleKey();
  }, [isOpen, refreshTenantModuleKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name_mother || !formData.phone) {
      toast.error('Vui lòng nhập tên và số điện thoại');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createCustomer({
        ...formData,
        address: formData.address || 'Chưa cập nhật'
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Thêm khách hàng thành công!');
        if (onSuccess && result.data) {
          onSuccess(result.data);
        }
        setFormData({ name_mother: '', phone: '', address: '', notes: '' });
        onClose();
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      toast.error('Đã xảy ra lỗi khi thêm khách hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white"
        >
          {/* Header */}
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Thêm khách nhanh</h2>
                <p className="text-sm text-slate-500 font-medium">Tạo hồ sơ khách hàng mới</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 hover:bg-rose-50 rounded-2xl transition-all text-slate-400 hover:text-rose-500 group"
            >
              <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <User className="w-4 h-4" /> {customerLabels.primaryNameLabel}
                </label>
                <input 
                  type="text" 
                  required
                  placeholder={customerLabels.primaryNamePlaceholder}
                  value={formData.name_mother}
                  onChange={(e) => setFormData({...formData, name_mother: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Số điện thoại
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Nhập số điện thoại..." 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Địa chỉ
                </label>
                <input 
                  type="text" 
                  placeholder="Nhập địa chỉ..." 
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-4">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black hover:bg-slate-50 transition-all uppercase tracking-widest active:scale-95"
              >
                Hủy
              </button>
              <button 
                type="submit"
                disabled={isSubmitting || !formData.name_mother || !formData.phone}
                className={cn(
                  "flex-1 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black transition-all shadow-xl shadow-primary/20 uppercase tracking-widest active:scale-95 flex items-center justify-center gap-3",
                  (isSubmitting || !formData.name_mother || !formData.phone) && "opacity-50 cursor-not-allowed grayscale"
                )}
              >
                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                {isSubmitting ? 'Đang lưu...' : 'Thêm khách'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
