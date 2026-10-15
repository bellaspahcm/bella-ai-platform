'use client';

import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Plus, User, Car, DollarSign, CheckCircle, ArrowRight, ArrowLeft, Search, UserPlus, Phone, MapPin, AlertCircle, Palette, Package } from 'lucide-react';

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'customer' | 'vehicle' | 'pricing' | 'review';

interface BookingFormData {
  // Customer
  customerId?: string;
  customerPhone: string;
  customerName: string;
  customerAddress: string;
  
  // Vehicle
  variantId: string;
  vehicleId?: string; // VIN allocation (optional)
  colorExterior: string;
  
  // Pricing
  totalPrice: number;
  depositAmount: number;
  depositPaid: number; // Immediate payment (optional)
}

interface Customer {
  id: string;
  name_mother: string;
  phone: string;
  address: string | null;
}

interface Brand {
  id: string;
  name: string;
}

interface Model {
  id: string;
  name: string;
}

interface Variant {
  id: string;
  name: string;
  year: number | null;
}

interface Vehicle {
  id: string;
  vin: string;
  color_exterior: string;
  status: string;
}

const POPULAR_COLORS = [
  { name: 'Trắng', value: 'Trắng', hex: '#FFFFFF' },
  { name: 'Đen', value: 'Đen', hex: '#000000' },
  { name: 'Xám', value: 'Xám', hex: '#6B7280' },
  { name: 'Bạc', value: 'Bạc', hex: '#C0C0C0' },
  { name: 'Đỏ', value: 'Đỏ', hex: '#DC2626' },
  { name: 'Xanh Dương', value: 'Xanh Dương', hex: '#2563EB' },
];

const STEPS: { key: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'customer', label: 'Khách Hàng', icon: User },
  { key: 'vehicle', label: 'Xe', icon: Car },
  { key: 'pricing', label: 'Giá & Cọc', icon: DollarSign },
  { key: 'review', label: 'Xác Nhận', icon: CheckCircle },
];

export function CreateBookingModal({ isOpen, onClose, onSuccess }: CreateBookingModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('customer');
  const [formData, setFormData] = useState<Partial<BookingFormData>>({
    customerPhone: '',
    customerName: '',
    customerAddress: '',
    variantId: '',
    colorExterior: '',
    totalPrice: 0,
    depositAmount: 0,
    depositPaid: 0,
  });

  // Customer search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Vehicle selection state
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionKey = useRef<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load brands on vehicle step
  useEffect(() => {
    if (currentStep === 'vehicle' && brands.length === 0) {
      const controller = new AbortController();
      setCatalogError(null);
      setIsLoadingBrands(true);
      fetch('/api/bella-auto/vehicles/brands', { signal: controller.signal })
        .then(res => {
          if (!res.ok) throw new Error('Catalog request failed');
          return res.json();
        })
        .then(data => { if (!controller.signal.aborted) setBrands(data.brands || []); })
        .catch(() => { if (!controller.signal.aborted) setCatalogError('Không tải được hãng xe.'); })
        .finally(() => { if (!controller.signal.aborted) setIsLoadingBrands(false); });
      return () => controller.abort();
    }
  }, [currentStep, brands.length]);

  // Load models when brand selected
  useEffect(() => {
    if (selectedBrand) {
      const controller = new AbortController();
      setCatalogError(null);
      setIsLoadingModels(true);
      setModels([]);
      setSelectedModel('');
      setVariants([]);
      setSelectedVariant(null);
      setAvailableVehicles([]);
      setSelectedVehicle(null);
      
      fetch(`/api/bella-auto/vehicles/models?brandId=${selectedBrand}`, { signal: controller.signal })
        .then(res => {
          if (!res.ok) throw new Error('Catalog request failed');
          return res.json();
        })
        .then(data => { if (!controller.signal.aborted) setModels(data.models || []); })
        .catch(() => { if (!controller.signal.aborted) setCatalogError('Không tải được dòng xe.'); })
        .finally(() => { if (!controller.signal.aborted) setIsLoadingModels(false); });
      return () => controller.abort();
    }
  }, [selectedBrand]);

  // Load variants when model selected
  useEffect(() => {
    if (selectedModel) {
      const controller = new AbortController();
      setCatalogError(null);
      setIsLoadingVariants(true);
      setVariants([]);
      setSelectedVariant(null);
      setAvailableVehicles([]);
      setSelectedVehicle(null);
      
      fetch(`/api/bella-auto/vehicles/variants?modelId=${selectedModel}`, { signal: controller.signal })
        .then(res => {
          if (!res.ok) throw new Error('Catalog request failed');
          return res.json();
        })
        .then(data => { if (!controller.signal.aborted) setVariants(data.variants || []); })
        .catch(() => { if (!controller.signal.aborted) setCatalogError('Không tải được phiên bản xe.'); })
        .finally(() => { if (!controller.signal.aborted) setIsLoadingVariants(false); });
      return () => controller.abort();
    }
  }, [selectedModel]);

  // Load available vehicles when variant and color selected
  useEffect(() => {
    if (formData.variantId && formData.colorExterior) {
      setIsLoadingVehicles(true);
      
      fetch(`/api/bella-auto/vehicles/available?variantId=${formData.variantId}&colorExterior=${encodeURIComponent(formData.colorExterior)}`)
        .then(res => res.json())
        .then(data => {
          setAvailableVehicles(data.vehicles || []);
          // Auto-select if only one available
          if (data.vehicles?.length === 1) {
            handleSelectVehicle(data.vehicles[0]);
          }
        })
        .catch(err => console.error('Failed to load available vehicles:', err))
        .finally(() => setIsLoadingVehicles(false));
    }
  }, [formData.variantId, formData.colorExterior]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bella-auto/customers/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.customers || []);
      } catch (error) {
        console.error('Customer search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Check for duplicate phone when creating new customer
  const checkDuplicatePhone = useCallback(async (phone: string) => {
    if (phone.length < 10) {
      setDuplicateWarning(null);
      return;
    }

    try {
      const res = await fetch(`/api/bella-auto/customers/search?q=${encodeURIComponent(phone)}`);
      const data = await res.json();
      
      if (data.customers && data.customers.length > 0) {
        const existing = data.customers.find((c: Customer) => c.phone === phone);
        if (existing) {
          setDuplicateWarning(`Số điện thoại này đã tồn tại cho khách hàng: ${existing.name_mother}`);
        } else {
          setDuplicateWarning(null);
        }
      } else {
        setDuplicateWarning(null);
      }
    } catch (error) {
      console.error('Duplicate check failed:', error);
    }
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customerId: customer.id,
      customerPhone: customer.phone,
      customerName: customer.name_mother,
      customerAddress: customer.address || '',
    }));
    setSearchQuery('');
    setSearchResults([]);
    setShowNewCustomerForm(false);
  };

  const handleNewCustomerToggle = () => {
    setShowNewCustomerForm(!showNewCustomerForm);
    setSelectedCustomer(null);
    setSearchQuery('');
    setSearchResults([]);
    setDuplicateWarning(null);
  };

  const handleSelectVariant = (variant: Variant) => {
    setSelectedVariant(variant);
    updateFormData('variantId', variant.id);
  };

  function handleSelectVehicle(vehicle: Vehicle | null) {
    setSelectedVehicle(vehicle);
    updateFormData('vehicleId', vehicle?.id);
  }

  function updateFormData(field: keyof BookingFormData, value: BookingFormData[keyof BookingFormData]) {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Check duplicate when phone changes in new customer form
    if (field === 'customerPhone' && showNewCustomerForm && typeof value === 'string') {
      checkDuplicatePhone(value);
    }
  }

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(STEPS[currentStepIndex + 1].key);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(STEPS[currentStepIndex - 1].key);
    }
  };

  const handleClose = () => {
    setCurrentStep('customer');
    setFormData({
      customerPhone: '',
      customerName: '',
      customerAddress: '',
      variantId: '',
      colorExterior: '',
      totalPrice: 0,
      depositAmount: 0,
      depositPaid: 0,
    });
    setSearchQuery('');
    setSearchResults([]);
    setShowNewCustomerForm(false);
    setSelectedCustomer(null);
    setDuplicateWarning(null);
    setSubmitError(null);
    setCatalogError(null);
    setIsSubmitting(false);
    submissionKey.current = null;
    onClose();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      submissionKey.current ??= crypto.randomUUID();
      const res = await fetch('/api/bella-auto/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submissionKey.current },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || 'Có lỗi xảy ra khi tạo booking');
        setIsSubmitting(false);
        return;
      }

      // Success - call callback and close
      if (onSuccess) {
        onSuccess();
      }
      handleClose();
    } catch (error) {
      console.error('Submit error:', error);
      setSubmitError('Không thể kết nối đến server');
      setIsSubmitting(false);
    }
  };

  const canProceedFromCustomer = selectedCustomer || (
    showNewCustomerForm && 
    formData.customerPhone && 
    formData.customerName && 
    !duplicateWarning
  );

  const canProceedFromVehicle = formData.variantId && formData.colorExterior;

  const canProceedFromPricing = formData.totalPrice && formData.totalPrice > 0 && 
    formData.depositAmount !== undefined && formData.depositAmount >= 0 &&
    formData.depositAmount <= (formData.totalPrice || 0);

  // Format number with thousand separator
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  const parseCurrency = (value: string) => {
    return parseInt(value.replace(/\D/g, '')) || 0;
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <div>
                    <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white">
                      Tạo Booking Mới
                    </Dialog.Title>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Bước {currentStepIndex + 1} / {STEPS.length}: {STEPS[currentStepIndex].label}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {/* Step Progress */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    {STEPS.map((step, idx) => {
                      const Icon = step.icon;
                      const isActive = idx === currentStepIndex;
                      const isCompleted = idx < currentStepIndex;
                      
                      return (
                        <Fragment key={step.key}>
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                isActive
                                  ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-lg'
                                  : isCompleted
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-slate-100 dark:bg-slate-900 text-slate-400'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle className="w-5 h-5" />
                              ) : (
                                <Icon className="w-5 h-5" />
                              )}
                            </div>
                            <span
                              className={`text-sm font-semibold hidden sm:block ${
                                isActive
                                  ? 'text-cyan-600 dark:text-cyan-400'
                                  : isCompleted
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>
                          {idx < STEPS.length - 1 && (
                            <div
                              className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                                isCompleted ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-slate-200 dark:bg-slate-800'
                              }`}
                            />
                          )}
                        </Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Body - Step Content */}
                <div className="p-6 min-h-[400px]">
                  {submitError && (
                    <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border-2 border-red-200 dark:border-red-800">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-red-900 dark:text-red-100 mb-1">
                            Lỗi tạo booking
                          </div>
                          <div className="text-sm text-red-700 dark:text-red-300">
                            {submitError}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 'customer' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Thông Tin Khách Hàng</h3>
                        <button
                          onClick={handleNewCustomerToggle}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            showNewCustomerForm
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg hover:shadow-xl'
                          }`}
                        >
                          {showNewCustomerForm ? (
                            <>
                              <Search className="w-4 h-4" />
                              Tìm Khách Cũ
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              Tạo Khách Mới
                            </>
                          )}
                        </button>
                      </div>

                      {!showNewCustomerForm ? (
                        // Search existing customers
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                              Tìm kiếm khách hàng theo SĐT hoặc tên
                            </label>
                            <div className="relative">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Nhập số điện thoại hoặc tên..."
                                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-cyan-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                              />
                              {isSearching && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                  <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Search Results */}
                          {searchResults.length > 0 && (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {searchResults.map((customer) => (
                                <button
                                  key={customer.id}
                                  onClick={() => handleSelectCustomer(customer)}
                                  className="w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-500 bg-white dark:bg-slate-900 text-left transition-all group"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="font-semibold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                                        {customer.name_mother}
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        <Phone className="w-4 h-4" />
                                        {customer.phone}
                                      </div>
                                      {customer.address && (
                                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                          <MapPin className="w-4 h-4" />
                                          {customer.address}
                                        </div>
                                      )}
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Selected Customer */}
                          {selectedCustomer && (
                            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-200 dark:border-emerald-800">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                                  <CheckCircle className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-emerald-900 dark:text-emerald-100">
                                    Đã chọn: {selectedCustomer.name_mother}
                                  </div>
                                  <div className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                                    SĐT: {selectedCustomer.phone}
                                  </div>
                                  {selectedCustomer.address && (
                                    <div className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                                      Địa chỉ: {selectedCustomer.address}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                              Không tìm thấy khách hàng nào
                            </div>
                          )}
                        </div>
                      ) : (
                        // Create new customer form
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                              Số điện thoại <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="tel"
                              value={formData.customerPhone || ''}
                              onChange={(e) => updateFormData('customerPhone', e.target.value)}
                              placeholder="0912345678"
                              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-cyan-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                            />
                            {duplicateWarning && (
                              <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-800 dark:text-amber-200">{duplicateWarning}</p>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                              Họ và tên <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={formData.customerName || ''}
                              onChange={(e) => updateFormData('customerName', e.target.value)}
                              placeholder="Nguyễn Văn A"
                              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-cyan-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                              Địa chỉ
                            </label>
                            <textarea
                              value={formData.customerAddress || ''}
                              onChange={(e) => updateFormData('customerAddress', e.target.value)}
                              placeholder="Nhập địa chỉ..."
                              rows={3}
                              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-cyan-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all resize-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === 'vehicle' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Chọn Xe</h3>

                      {catalogError && (
                        <div role="alert" className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                          <AlertCircle className="w-5 h-5 shrink-0" />
                          {catalogError}
                        </div>
                      )}

                      {/* Brand Selection */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          Hãng xe <span className="text-red-500">*</span>
                        </label>
                        {isLoadingBrands ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {brands.map((brand) => (
                              <button
                                key={brand.id}
                                onClick={() => setSelectedBrand(brand.id)}
                                className={`p-4 rounded-xl border-2 transition-all text-center ${
                                  selectedBrand === brand.id
                                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/50'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-cyan-300'
                                }`}
                              >
                                <div className="font-semibold text-slate-900 dark:text-white">{brand.name}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Model Selection */}
                      {selectedBrand && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Dòng xe <span className="text-red-500">*</span>
                          </label>
                          {isLoadingModels ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : models.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                              Không có dòng xe nào
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {models.map((model) => (
                                <button
                                  key={model.id}
                                  onClick={() => setSelectedModel(model.id)}
                                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                                    selectedModel === model.id
                                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/50'
                                      : 'border-slate-200 dark:border-slate-700 hover:border-cyan-300'
                                  }`}
                                >
                                  <div className="font-semibold text-slate-900 dark:text-white">{model.name}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Variant Selection */}
                      {selectedModel && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Phiên bản <span className="text-red-500">*</span>
                          </label>
                          {isLoadingVariants ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : variants.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                              Không có phiên bản nào
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {variants.map((variant) => (
                                <button
                                  key={variant.id}
                                  onClick={() => handleSelectVariant(variant)}
                                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                                    selectedVariant?.id === variant.id
                                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/50'
                                      : 'border-slate-200 dark:border-slate-700 hover:border-cyan-300'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="font-semibold text-slate-900 dark:text-white">{variant.name}</div>
                                      {variant.year != null && (
                                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Năm {variant.year}</div>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Color Selection */}
                      {selectedVariant && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Màu ngoại thất <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                            {POPULAR_COLORS.map((color) => (
                              <button
                                key={color.value}
                                onClick={() => updateFormData('colorExterior', color.value)}
                                className={`p-3 rounded-xl border-2 transition-all ${
                                  formData.colorExterior === color.value
                                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/50'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-cyan-300'
                                }`}
                              >
                                <div
                                  className="w-8 h-8 rounded-full mx-auto border-2 border-slate-300 dark:border-slate-600"
                                  style={{ backgroundColor: color.hex }}
                                />
                                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-2 text-center">
                                  {color.name}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* VIN Allocation (Optional) */}
                      {formData.variantId && formData.colorExterior && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Phân bổ VIN từ kho (Tùy chọn)
                          </label>
                          {isLoadingVehicles ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="w-6 h-6 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : availableVehicles.length === 0 ? (
                            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-800 dark:text-amber-200">
                                  Không có xe nào sẵn trong kho với màu này. Booking sẽ được tạo ở trạng thái chờ xe về.
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <button
                                onClick={() => handleSelectVehicle(null)}
                                className={`w-full p-3 rounded-xl border-2 transition-all text-left text-sm ${
                                  !selectedVehicle
                                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/50 text-cyan-900 dark:text-cyan-100'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-cyan-300'
                                }`}
                              >
                                Không phân bổ (chờ xe về)
                              </button>
                              {availableVehicles.map((vehicle) => (
                                <button
                                  key={vehicle.id}
                                  onClick={() => handleSelectVehicle(vehicle)}
                                  className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                                    selectedVehicle?.id === vehicle.id
                                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/50'
                                      : 'border-slate-200 dark:border-slate-700 hover:border-cyan-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                                      {vehicle.vin}
                                    </div>
                                    <div className="text-xs px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                      Sẵn sàng
                                    </div>
                                  </div>
                                </button>
                              ))}
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                Tìm thấy {availableVehicles.length} xe sẵn sàng
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === 'pricing' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Giá Bán & Đặt Cọc</h3>

                      {/* Total Price */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          Giá bán <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.totalPrice ? formatCurrency(formData.totalPrice) : ''}
                            onChange={(e) => updateFormData('totalPrice', parseCurrency(e.target.value))}
                            placeholder="850,000,000"
                            className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-cyan-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-right font-mono"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-semibold">
                            VNĐ
                          </div>
                        </div>
                      </div>

                      {/* Deposit Amount */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          Số tiền cọc yêu cầu <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.depositAmount ? formatCurrency(formData.depositAmount) : ''}
                            onChange={(e) => updateFormData('depositAmount', parseCurrency(e.target.value))}
                            placeholder="50,000,000"
                            className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-cyan-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-right font-mono"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-semibold">
                            VNĐ
                          </div>
                        </div>
                        {formData.totalPrice && formData.depositAmount && (
                          <div className="flex items-center justify-between text-sm mt-2">
                            <span className="text-slate-500 dark:text-slate-400">
                              Tỷ lệ cọc: {((formData.depositAmount / formData.totalPrice) * 100).toFixed(1)}%
                            </span>
                            {formData.depositAmount > formData.totalPrice && (
                              <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                Cọc không được vượt giá bán
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quick Deposit Presets */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          Chọn nhanh tỷ lệ cọc
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {[10, 20, 30, 50].map((percent) => (
                            <button
                              key={percent}
                              onClick={() => {
                                if (formData.totalPrice) {
                                  updateFormData('depositAmount', Math.round(formData.totalPrice * (percent / 100)));
                                }
                              }}
                              className="px-4 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold transition-all"
                            >
                              {percent}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Immediate Payment (Optional) */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-3">
                          <input
                            type="checkbox"
                            id="immediatePayment"
                            checked={(formData.depositPaid || 0) > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updateFormData('depositPaid', formData.depositAmount || 0);
                              } else {
                                updateFormData('depositPaid', 0);
                              }
                            }}
                            className="w-5 h-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          <label htmlFor="immediatePayment" className="font-semibold text-slate-900 dark:text-white">
                            Khách đã thanh toán cọc ngay
                          </label>
                        </div>
                        
                        {(formData.depositPaid || 0) > 0 && (
                          <div className="relative">
                            <input
                              type="text"
                              value={formData.depositPaid ? formatCurrency(formData.depositPaid) : ''}
                              onChange={(e) => updateFormData('depositPaid', parseCurrency(e.target.value))}
                              placeholder="50,000,000"
                              className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-cyan-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-right font-mono"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-semibold">
                              VNĐ
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Summary */}
                      {formData.totalPrice && formData.depositAmount && (
                        <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border-2 border-cyan-200 dark:border-cyan-800">
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-700 dark:text-slate-300">Giá bán:</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {formatCurrency(formData.totalPrice)} VNĐ
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-700 dark:text-slate-300">Cọc yêu cầu:</span>
                              <span className="font-bold text-cyan-600 dark:text-cyan-400">
                                {formatCurrency(formData.depositAmount)} VNĐ
                              </span>
                            </div>
                            {(formData.depositPaid || 0) > 0 && (
                              <div className="flex items-center justify-between pt-2 border-t border-cyan-200 dark:border-cyan-800">
                                <span className="text-slate-700 dark:text-slate-300">Đã thanh toán:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(formData.depositPaid || 0)} VNĐ
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-2 border-t border-cyan-200 dark:border-cyan-800">
                              <span className="text-slate-700 dark:text-slate-300">Còn lại cần thu:</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {formatCurrency(formData.totalPrice - (formData.depositPaid || 0))} VNĐ
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === 'review' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Xác Nhận Thông Tin</h3>

                      {/* Customer Info */}
                      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                            Khách Hàng
                          </h4>
                          <button
                            onClick={() => setCurrentStep('customer')}
                            className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                          >
                            Sửa
                          </button>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <span className="text-slate-500 dark:text-slate-400 w-24">Họ tên:</span>
                            <span className="font-semibold text-slate-900 dark:text-white flex-1">
                              {formData.customerName}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-slate-500 dark:text-slate-400 w-24">SĐT:</span>
                            <span className="font-mono text-slate-900 dark:text-white flex-1">
                              {formData.customerPhone}
                            </span>
                          </div>
                          {formData.customerAddress && (
                            <div className="flex items-start gap-2">
                              <span className="text-slate-500 dark:text-slate-400 w-24">Địa chỉ:</span>
                              <span className="text-slate-900 dark:text-white flex-1">
                                {formData.customerAddress}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vehicle Info */}
                      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Car className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                            Thông Tin Xe
                          </h4>
                          <button
                            onClick={() => setCurrentStep('vehicle')}
                            className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                          >
                            Sửa
                          </button>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <span className="text-slate-500 dark:text-slate-400 w-24">Hãng xe:</span>
                            <span className="font-semibold text-slate-900 dark:text-white flex-1">
                              {brands.find(b => b.id === selectedBrand)?.name}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-slate-500 dark:text-slate-400 w-24">Dòng xe:</span>
                            <span className="font-semibold text-slate-900 dark:text-white flex-1">
                              {models.find(m => m.id === selectedModel)?.name}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-slate-500 dark:text-slate-400 w-24">Phiên bản:</span>
                            <span className="font-semibold text-slate-900 dark:text-white flex-1">
                              {selectedVariant?.name}
                              {selectedVariant?.year != null && ` (${selectedVariant.year})`}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-slate-500 dark:text-slate-400 w-24">Màu sắc:</span>
                            <span className="font-semibold text-slate-900 dark:text-white flex-1">
                              {formData.colorExterior}
                            </span>
                          </div>
                          {selectedVehicle && (
                            <div className="flex items-start gap-2">
                              <span className="text-slate-500 dark:text-slate-400 w-24">VIN:</span>
                              <span className="font-mono text-emerald-600 dark:text-emerald-400 flex-1">
                                {selectedVehicle.vin}
                              </span>
                            </div>
                          )}
                          {!selectedVehicle && (
                            <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                              <span className="text-xs text-amber-800 dark:text-amber-200">
                                Chưa phân bổ VIN - Chờ xe về
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Pricing Info */}
                      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                            Thanh Toán
                          </h4>
                          <button
                            onClick={() => setCurrentStep('pricing')}
                            className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                          >
                            Sửa
                          </button>
                        </div>
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                            <span className="text-slate-500 dark:text-slate-400">Giá bán:</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatCurrency(formData.totalPrice || 0)} VNĐ
                            </span>
                          </div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                            <span className="text-slate-500 dark:text-slate-400">Cọc yêu cầu:</span>
                            <span className="font-bold text-cyan-600 dark:text-cyan-400">
                              {formatCurrency(formData.depositAmount || 0)} VNĐ
                            </span>
                          </div>
                          {(formData.depositPaid || 0) > 0 && (
                            <>
                              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500 dark:text-slate-400">Đã thanh toán:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(formData.depositPaid || 0)} VNĐ
                                </span>
                              </div>
                              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                                <div className="text-xs text-emerald-800 dark:text-emerald-200 font-semibold">
                                  ✓ Đã xác nhận thanh toán cọc
                                </div>
                              </div>
                            </>
                          )}
                          {(!formData.depositPaid || formData.depositPaid === 0) && (
                            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                              <div className="text-xs text-amber-800 dark:text-amber-200">
                                ⏳ Chưa thanh toán - Booking sẽ ở trạng thái chờ cọc
                              </div>
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-2 border-t-2 border-slate-300 dark:border-slate-600">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Còn lại:</span>
                            <span className="text-lg font-bold text-slate-900 dark:text-white">
                              {formatCurrency((formData.totalPrice || 0) - (formData.depositPaid || 0))} VNĐ
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Confirmation Note */}
                      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/50 border-2 border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                          <div className="text-sm text-blue-900 dark:text-blue-100">
                            <p className="font-semibold mb-1">Xác nhận tạo booking</p>
                            <p className="text-blue-700 dark:text-blue-300">
                              Booking sẽ được tạo với trạng thái {(formData.depositPaid || 0) > 0 ? '"Đã cọc"' : '"Chờ cọc"'}. 
                              {!selectedVehicle && ' VIN sẽ được phân bổ sau khi xe về kho.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer - Navigation */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <button
                    onClick={handleBack}
                    disabled={isFirstStep}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Quay Lại
                  </button>

                  {!isLastStep ? (
                    <button
                      onClick={handleNext}
                      disabled={
                        (currentStep === 'customer' && !canProceedFromCustomer) ||
                        (currentStep === 'vehicle' && !canProceedFromVehicle) ||
                        (currentStep === 'pricing' && !canProceedFromPricing)
                      }
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Tiếp Theo
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Đang tạo...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Tạo Booking
                        </>
                      )}
                    </button>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
