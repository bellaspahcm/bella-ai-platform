'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { formatMoneyInput, parseMoneyInput } from '@bella/shared';
import { parseDecimalInput, parseIntegerInput } from '@/lib/utils';;
import { getInventoryItems, getPackageMaterials, upsertPackageMaterials } from '@/services/inventory-actions';
import {
  createPackage,
  deletePackage,
  getPackages,
  updatePackage,
  type PackageActionInput,
} from '@/services/package-actions';
import {
  createBookingResource,
  deleteBookingResource,
  getBookingResources,
  updateBookingResource,
} from '@/services/booking-resource-actions';
import { getTenantSettings } from '@/services/tenant-actions';
import {
  getDefaultTenantModuleKey,
  normalizeEnabledModules,
  type TenantEnabledModules,
} from '@/lib/business-rules/tenant-modules';
import type { Json } from '@/types/database.types';

import { createBlankBookingResourceForm, createBlankServiceForm, PAGE_SIZE } from '../constants';
import type {
  BookingResource,
  BookingResourceFormState,
  InventoryItem,
  MaterialRow,
  ResourceStatus,
  ResourceType,
  ServiceModalMode,
  ServiceModuleFilter,
  ServiceModuleKey,
  ServicePackage,
  ServiceStatus,
  ServiceStatusFilter,
  ServiceKind,
} from '../types';

type PackageMaterialWithItem = {
  item_id: string | null;
  quantity_per_session: number | null;
  inventory_items: Pick<InventoryItem, 'id' | 'name' | 'unit'> | null;
};

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
);

const EMPTY_ENABLED_MODULES: TenantEnabledModules = {
  babycare: false,
  beauty_spa: false,
  manufacturing: false,
  student_training: false,
  industrial_cleaning: false,
  real_estate: false,
  bella_auto: false,
  bella_healthcare: false,
  bella_education: false,
  bella_interior: false,
};

type JsonObject = { [key: string]: Json | undefined };

function isJsonObject(value: Json | null): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getMetadataText(metadata: Json | null, key: string, fallback = '') {
  if (!isJsonObject(metadata)) return fallback;
  const value = metadata[key];
  return typeof value === 'string' ? value : fallback;
}

function getMetadataRisModality(metadata: Json | null) {
  const value = getMetadataText(metadata, 'risModality');
  return (
    value === 'XRAY'
    || value === 'CT'
    || value === 'MRI'
    || value === 'ULTRASOUND'
    || value === 'ENDOSCOPY'
  ) ? value : 'XRAY';
}

const createDefaultPackages = (moduleKey: ServiceModuleKey): PackageActionInput[] => {
  if (moduleKey === 'industrial_cleaning') {
    return [
      {
        name: 'Vệ sinh cơ bản',
        price: 5000000,
        duration: '90 phút/buổi',
        total_sessions: 12,
        details: ['Vệ sinh sàn nhà, Lau kính, Dọn toilet', 'Thu gom rác thải sinh hoạt'],
        offer: '',
        ktv_commission: 150000,
        status: 'active',
        module_key: 'industrial_cleaning',
      },
      {
        name: 'Vệ sinh tiêu chuẩn',
        price: 8000000,
        duration: '90 phút/buổi',
        total_sessions: 16,
        details: ['Hút bụi, lau sàn, vệ sinh cửa kính', 'Lau chùi bụi bẩn thiết bị văn phòng', 'Vệ sinh toilet, bồn rửa mặt, khu vực pantry'],
        offer: '',
        ktv_commission: 150000,
        status: 'active',
        module_key: 'industrial_cleaning',
      },
      {
        name: 'Vệ sinh cao cấp VIP',
        price: 12000000,
        duration: '90 phút/buổi',
        total_sessions: 20,
        details: ['Vệ sinh sâu sàn nhà, đánh bóng, tẩy vết bẩn', 'Giặt thảm, ghế văn phòng, rèm cửa', 'Khử trùng toàn bộ không gian làm việc', 'Vệ sinh hệ thống điều hòa, thông gió'],
        offer: '',
        ktv_commission: 150000,
        status: 'active',
        module_key: 'industrial_cleaning',
      },
    ];
  }

  if (moduleKey === 'bella_healthcare') {
    return [
      {
        name: 'Cấy ghép Implant răng (#36 / Nobel Biocare)',
        price: 24000000,
        duration: '120 phút/buổi',
        total_sessions: 4,
        details: ['Khám tư vấn & Chụp phim CT ConeBeam 3D', 'Cắm trụ Implant Thụy Sĩ Nobel Biocare', 'Gắn khớp nối Abutment & Lấy dấu răng', 'Phục hình mão sứ Zirconia cao cấp'],
        offer: 'Bảo hành trụ Implant trọn đời',
        ktv_commission: 500000,
        status: 'active',
        module_key: 'bella_healthcare',
      },
      {
        name: 'Chỉnh nha niềng răng mặt trong (Invisalign)',
        price: 85000000,
        duration: '60 phút/buổi',
        total_sessions: 18,
        details: ['Quét mẫu răng 3D iTero Element 5D', 'Lập phác đồ điều trị ClinCheck 3D', 'Giao khay niềng trong suốt Invisalign chính hãng', 'Tái khám định kỳ & Siết khay theo lộ trình'],
        offer: 'Tặng kèm bộ hàm duy trì & Máy tăm nước V300',
        ktv_commission: 1000000,
        status: 'active',
        module_key: 'bella_healthcare',
      },
      {
        name: 'Điều trị nha khoa tổng quát & Bọc sứ',
        price: 15000000,
        duration: '90 phút/buổi',
        total_sessions: 3,
        details: ['Cạo vôi răng & Đánh bóng chuẩn Y khoa', 'Tẩy trắng răng công nghệ Laser Whitening', 'Mài cùi răng & Bọc mão sứ Cercon HT'],
        offer: 'Giảm 20% khi mua gói combo gia đình',
        ktv_commission: 300000,
        status: 'active',
        module_key: 'bella_healthcare',
      },
    ];
  }

  if (moduleKey === 'beauty_spa') {
    return [
      {
        name: 'Triệt Lông Diode Laser',
        price: 3500000,
        duration: '60 phút/buổi',
        total_sessions: 10,
        details: ['Tẩy da chết vùng cần triệt', 'Thoa gel chuyên dụng làm dịu mát', 'Đi máy Diode Laser bước sóng 808nm', 'Lau sạch và thoa kem dưỡng ẩm bảo vệ'],
        offer: 'Bảo hành trọn đời dịch vụ',
        ktv_commission: 100000,
        status: 'active',
        module_key: 'beauty_spa',
      },
      {
        name: 'Gội Đầu Dưỡng Sinh Đông Y',
        price: 250000,
        duration: '75 phút/buổi',
        total_sessions: 1,
        details: ['Khai huyệt vùng đầu, massage vai gáy cơ bản', 'Gội đầu lần 1 bằng nước thảo dược bồ kết cô đặc', 'Massage mặt, đắp mặt nạ organic', 'Gội đầu lần 2 kết hợp đi lược sừng đả thông kinh lạc', 'Sấy tóc và thoa serum dưỡng tóc'],
        offer: 'Tặng kèm trà thảo mộc thư giãn',
        ktv_commission: 50000,
        status: 'active',
        module_key: 'beauty_spa',
      },
      {
        name: 'Facial Cấp Ẩm Chuyên Sâu',
        price: 500000,
        duration: '90 phút/buổi',
        total_sessions: 1,
        details: ['Tẩy trang, rửa mặt sạch sâu', 'Tẩy tế bào chết vật lý kết hợp xông hơi nóng', 'Hút bã nhờn, mụn cám bằng máy hút chân không', 'Massage mặt nâng cơ nâng cao bằng kem collagen', 'Điện di tinh chất Hyaluronic Acid (HA) làm mát sâu', 'Đắp mặt nạ ngủ làm dịu và phục hồi'],
        offer: 'Ưu đãi trải nghiệm giảm 35%',
        ktv_commission: 80000,
        status: 'active',
        module_key: 'beauty_spa',
      },
    ];
  }

  return [
    {
      name: 'Gói Bầu Thư Giãn Bella',
      price: 450000,
      duration: '75 phút/buổi',
      total_sessions: 1,
      details: ['Ngâm chân thảo dược thải độc', 'Massage body thảo dược nhẹ nhàng', 'Chăm sóc da mặt cơ bản organic', 'Thư giãn vùng đầu, cổ, vai gáy'],
      offer: 'Tặng kèm trà sữa hạt organic sau liệu trình',
      status: 'inactive',
      module_key: 'babycare',
    },
    {
      name: 'Gói Bầu VIP Toàn Diện',
      price: 690000,
      duration: '100 phút/buổi',
      total_sessions: 1,
      details: ['Rửa chân và xông chân đá muối Himalaya', 'Massage chuyên sâu thắt lưng, hông', 'Massage Thụy Điển kết hợp đá nóng bazan', 'Chăm sóc da mặt chuyên sâu sữa ong chúa', 'Gội đầu dưỡng sinh thảo dược tự nhiên'],
      offer: 'Ưu đãi trải nghiệm buổi đầu giảm 30%',
      status: 'inactive',
      module_key: 'babycare',
    },
    {
      name: 'Gói Phục Hồi Cơ Bản',
      price: 650000,
      duration: '90 phút/buổi',
      total_sessions: 1,
      details: ['Xông tắm thảo dược Dao Đỏ tái tạo sinh lực', 'Massage thông tắc tia sữa, gọi sữa về', 'Massage bụng tống sản dịch bằng tinh dầu gừng', 'Quấn muối thảo dược giúp săn cơ bụng'],
      offer: 'Hỗ trợ tư vấn nuôi con bằng sữa mẹ miễn phí',
      status: 'inactive',
      module_key: 'babycare',
    },
    {
      name: 'Gói Eo Thon Dáng Ngọc VIP',
      price: 950000,
      duration: '120 phút/buổi',
      total_sessions: 1,
      details: ['Chăm sóc đầy đủ gói Phục Hồi Cơ Bản', 'Đắp men rượu thuốc Bắc kết hợp chạy máy RF săn cơ', 'Đắp mặt nạ nghệ hạ thổ sáng hồng da', 'Massage body toàn thân giải tỏa trầm cảm sau sinh', 'Chăm sóc và tẩy tế bào chết body thảo mộc'],
      offer: 'Tặng 01 buổi massage mặt chuyên sâu',
      status: 'inactive',
      module_key: 'babycare',
    },
    {
      name: 'Tắm Bé Chuẩn Y Khoa',
      price: 200000,
      duration: '45 phút/buổi',
      total_sessions: 1,
      details: ['Massage kích hoạt giác quan cơ/xương trước khi tắm', 'Tắm chuẩn y khoa, vệ sinh rốn, mắt, mũi, tai kỹ lưỡng', 'Hơ lá trầu giữ ấm ngực, thóp đầu và các khớp', 'Bôi tinh dầu tràm bảo vệ hô hấp'],
      offer: 'Tặng kèm tưa lưỡi thảo dược',
      status: 'inactive',
      module_key: 'babycare',
    },
    {
      name: 'Gói Bé Yêu Thông Minh VIP',
      price: 350000,
      duration: '60 phút/buổi',
      total_sessions: 1,
      details: ['Massage nâng cao kích thích hệ tiêu hóa, chống đầy hơi', 'Tắm rửa sát khuẩn nước thảo dược tự nhiên', 'Hơ lá trầu ấm áp theo phương pháp cung đình', 'Bơi thủy liệu (Hydrotherapy) phát triển thể chất', 'Tập vận động phản xạ sớm nâng cao chỉ số EQ/IQ'],
      offer: 'Ưu đãi trải nghiệm giảm 20%',
      status: 'inactive',
      module_key: 'babycare',
    },
    {
      name: 'Gói Bella Home-Care Tiêu Chuẩn',
      price: 7900000,
      duration: '90 phút/buổi',
      total_sessions: 10,
      details: ['5 buổi Chăm Sóc Phục Hồi cho mẹ sau sinh tại nhà', '5 buổi Tắm Bé & Massage chuẩn y khoa tại nhà', 'KTV là điều dưỡng có chứng chỉ hành nghề y tế'],
      offer: 'Tặng thêm 01 hũ muối thảo dược quấn bụng trị giá 350k',
      status: 'inactive',
      module_key: 'babycare',
    },
    {
      name: 'Gói Hoàng Gia Bella Signature',
      price: 18500000,
      duration: '120 phút/buổi',
      total_sessions: 25,
      details: ['10 buổi Chăm sóc Bầu VIP thư giãn giảm đau nhức', '15 buổi Liệu trình Phục Hồi Eo Thon Dáng Ngọc sau sinh', '15 buổi Tắm Bé & Bơi Thủy Liệu VIP kích thích phát triển', 'Miễn phí tư vấn dinh dưỡng cùng Bác sĩ Sản Nhi trong suốt thai kỳ'],
      offer: 'Tặng hộp quà Premium gồm 05 tinh dầu cao cấp và 01 túi thảo dược chườm mắt',
      status: 'inactive',
      module_key: 'babycare',
    },
  ];
};

export function useServicesPageState() {
  const [services, setServices] = useState<ServicePackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ServiceModalMode>('add');
  const [selectedService, setSelectedService] = useState<ServicePackage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>('all');
  const [moduleFilter, setModuleFilter] = useState<ServiceModuleFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [form, setForm] = useState(createBlankServiceForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [enabledModules, setEnabledModules] = useState<TenantEnabledModules>(EMPTY_ENABLED_MODULES);
  const [hasLoadedTenantModules, setHasLoadedTenantModules] = useState(false);
  const [isBeautySpaEnabled, setIsBeautySpaEnabled] = useState(false);
  const [bookingResources, setBookingResources] = useState<BookingResource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [resourceForm, setResourceForm] = useState<BookingResourceFormState>(createBlankBookingResourceForm);
  const [isSavingResource, setIsSavingResource] = useState(false);
  const [tenantName, setTenantName] = useState('');

  const updateSearchQuery = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const updateStatusFilter = (value: ServiceStatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const updateModuleFilter = (value: ServiceModuleFilter) => {
    const safeValue = value === 'all' || enabledModules[value] ? value : 'all';
    setModuleFilter(safeValue);
    setCurrentPage(1);
  };

  const setName = (name: string) => setForm(prev => ({ ...prev, name }));
  const setPrice = (price: string) => setForm(prev => ({ ...prev, price }));
  const setDuration = (duration: string) => setForm(prev => ({ ...prev, duration }));
  const setSessions = (sessions: string) => setForm(prev => ({ ...prev, sessions }));
  const setOffer = (offer: string) => setForm(prev => ({ ...prev, offer }));
  const setDetails = (details: string) => setForm(prev => ({ ...prev, details }));
  const setKtvCommission = (ktvCommission: string) => setForm(prev => ({ ...prev, ktvCommission }));
  const setStatus = (status: ServiceStatus | ((previous: ServiceStatus) => ServiceStatus)) => {
    setForm(prev => ({
      ...prev,
      status: typeof status === 'function' ? status(prev.status) : status,
    }));
  };
  const setModuleKey = (moduleKey: ServiceModuleKey) => setForm(prev => ({ ...prev, moduleKey }));
  const setServiceKind = (serviceKind: ServiceKind) => {
    setForm(prev => ({ ...prev, serviceKind }));
  };
  const setLisCode = (lisCode: string) => setForm(prev => ({ ...prev, lisCode }));
  const setLisSampleType = (lisSampleType: string) => setForm(prev => ({ ...prev, lisSampleType }));
  const setLisTubeColor = (lisTubeColor: string) => setForm(prev => ({ ...prev, lisTubeColor }));
  const setRisCode = (risCode: string) => setForm(prev => ({ ...prev, risCode }));
  const setRisModality = (risModality: 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND' | 'ENDOSCOPY') => setForm(prev => ({ ...prev, risModality }));
  const setRisBodySite = (risBodySite: string) => setForm(prev => ({ ...prev, risBodySite }));
  const setServiceCategory = (serviceCategory: string) => setForm(prev => ({ ...prev, serviceCategory }));
  const setDefaultDurationMinutes = (defaultDurationMinutes: string) => {
    setForm(prev => ({ ...prev, defaultDurationMinutes }));
  };
  const setRequiresResource = (requiresResource: boolean) => setForm(prev => ({ ...prev, requiresResource }));
  const setDefaultResourceType = (defaultResourceType: ResourceType) => setForm(prev => ({ ...prev, defaultResourceType }));
  const setBeforeAfterRequired = (beforeAfterRequired: boolean) => {
    setForm(prev => ({ ...prev, beforeAfterRequired }));
  };
  const setCareNoteTemplate = (careNoteTemplate: string) => setForm(prev => ({ ...prev, careNoteTemplate }));

  const setResourceName = (name: string) => setResourceForm(prev => ({ ...prev, name }));
  const setResourceType = (resourceType: ResourceType) => setResourceForm(prev => ({ ...prev, resourceType }));
  const setResourceStatus = (status: ResourceStatus) => setResourceForm(prev => ({ ...prev, status }));
  const setResourceCapacity = (capacity: string) => setResourceForm(prev => ({ ...prev, capacity }));
  const setResourceLocationNote = (locationNote: string) => setResourceForm(prev => ({ ...prev, locationNote }));

  const resetForm = useCallback(() => {
    setForm({
      ...createBlankServiceForm(),
      moduleKey: getDefaultTenantModuleKey(enabledModules),
    });
    setSelectedService(null);
    setMaterialRows([]);
  }, [enabledModules]);

  const resetResourceForm = useCallback(() => {
    setResourceForm(createBlankBookingResourceForm());
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const packages = await getPackages();
      setServices(packages);
    } catch (error) {
      console.error('Load data error:', error);
      toast.error('Không thể tải danh sách dịch vụ');
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadInventoryItems = useCallback(async () => {
    try {
      const items = await getInventoryItems();
      setInventoryItems(items);
    } catch (error) {
      console.error('Load inventory items error:', error);
      toast.error(getErrorMessage(error, 'Không thể tải danh mục vật tư'));
    }
  }, []);

  const loadTenantModuleConfig = useCallback(async () => {
    try {
      const tenant = await getTenantSettings();
      setTenantName(tenant?.name || '');
      const modules = normalizeEnabledModules(tenant?.enabled_modules);
      const beautySpaEnabled = modules.beauty_spa || modules.bella_healthcare;
      const defaultModuleKey = getDefaultTenantModuleKey(modules);
      setEnabledModules(modules);
      setIsBeautySpaEnabled(beautySpaEnabled);
      setHasLoadedTenantModules(true);
      if (!beautySpaEnabled) setModuleFilter('all');
      setForm((current) => (
        modules[current.moduleKey]
          ? current
          : { ...current, moduleKey: defaultModuleKey }
      ));
      return modules;
    } catch (error) {
      console.error('Load tenant module config error:', error);
      toast.error(getErrorMessage(error, 'Không thể tải cấu hình module'));
      setEnabledModules(EMPTY_ENABLED_MODULES);
      setIsBeautySpaEnabled(false);
      setHasLoadedTenantModules(true);
      setModuleFilter('all');
      return EMPTY_ENABLED_MODULES;
    }
  }, []);

  const loadBookingResources = useCallback(async () => {
    setLoadingResources(true);
    try {
      const result = await getBookingResources();
      if (!result.success) {
        toast.error(result.error);
        setBookingResources([]);
        return;
      }
      setBookingResources(result.data);
    } catch (error) {
      console.error('Load booking resources error:', error);
      toast.error(getErrorMessage(error, 'Không thể tải tài nguyên đặt lịch'));
      setBookingResources([]);
    } finally {
      setLoadingResources(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    const loadModuleScopedResources = async () => {
      const modules = await loadTenantModuleConfig();
      if (modules.beauty_spa) {
        await loadBookingResources();
        return;
      }
      setBookingResources([]);
      resetResourceForm();
    };

    await Promise.all([loadData(), loadInventoryItems(), loadModuleScopedResources()]);
  }, [loadBookingResources, loadData, loadInventoryItems, loadTenantModuleConfig, resetResourceForm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshData]);

  const openAddModal = useCallback(() => {
    setModalMode('add');
    resetForm();
    setIsModalOpen(true);
  }, [resetForm]);

  const openEditModal = useCallback(async (service: ServicePackage) => {
    setModalMode('edit');
    setSelectedService(service);
    setForm({
      name: service.name,
      price: formatMoneyInput(service.price),
      duration: service.duration?.replace(/[^\d]/g, '') || '90',
      sessions: String(parseIntegerInput(service.total_sessions, { min: 1, max: 100, fallback: 10 })),
      offer: service.offer || '',
      details: Array.isArray(service.details) ? service.details.join(', ') : (service.details || ''),
      ktvCommission: formatMoneyInput(service.ktv_commission ?? 150000),
      status: service.status === 'active' ? 'active' : 'inactive',
      moduleKey: service.module_key === 'beauty_spa' ? 'beauty_spa'
        : service.module_key === 'industrial_cleaning' ? 'industrial_cleaning'
        : service.module_key === 'bella_healthcare' ? 'bella_healthcare'
        : 'babycare',
      serviceKind: (
        service.service_kind === 'single_service'
        || service.service_kind === 'retail_product'
        || service.service_kind === 'consultation'
        || service.service_kind === 'lis_test'
        || service.service_kind === 'ris_imaging'
      ) ? service.service_kind : 'treatment_package',
      serviceCategory: service.service_category || '',
      defaultDurationMinutes: String(parseIntegerInput(service.default_duration_minutes, { min: 1, max: 1440, fallback: 90 })),
      requiresResource: service.requires_resource === true,
      defaultResourceType: (
        service.default_resource_type === 'room'
        || service.default_resource_type === 'machine'
        || service.default_resource_type === 'chair'
        || service.default_resource_type === 'other'
      ) ? service.default_resource_type : 'bed',
      beforeAfterRequired: service.before_after_required === true,
      careNoteTemplate: service.care_note_template || '',
      lisCode: getMetadataText(service.metadata, 'lisCode'),
      lisSampleType: getMetadataText(service.metadata, 'lisSampleType'),
      lisTubeColor: getMetadataText(service.metadata, 'lisTubeColor'),
      risCode: getMetadataText(service.metadata, 'risCode'),
      risModality: getMetadataRisModality(service.metadata),
      risBodySite: getMetadataText(service.metadata, 'risBodySite'),
    });
    setMaterialRows([]);
    setIsModalOpen(true);

    setLoadingMaterials(true);
    try {
      const mats = await getPackageMaterials(service.id);
      const rows: MaterialRow[] = (mats as PackageMaterialWithItem[]).map(m => ({
        item_id: m.item_id || m.inventory_items?.id || '',
        quantity_per_session: parseDecimalInput(m.quantity_per_session, { min: 0 }),
        name: m.inventory_items?.name || undefined,
        unit: m.inventory_items?.unit || undefined,
      }));
      setMaterialRows(rows);
    } catch (error) {
      console.error('Load package materials error:', error);
      toast.error('Không tải được định mức tiêu hao của gói');
    } finally {
      setLoadingMaterials(false);
    }
  }, []);

  const addMaterialRow = () => {
    setMaterialRows(prev => [...prev, { item_id: '', quantity_per_session: '' }]);
  };

  const updateMaterialRow = (idx: number, patch: Partial<MaterialRow>) => {
    setMaterialRows(prev => prev.map((row, index) => index === idx ? { ...row, ...patch } : row));
  };

  const removeMaterialRow = (idx: number) => {
    setMaterialRows(prev => prev.filter((_, index) => index !== idx));
  };

  const editBookingResource = (resource: BookingResource) => {
    setResourceForm({
      id: resource.id,
      name: resource.name,
      resourceType: (
        resource.resource_type === 'room'
        || resource.resource_type === 'machine'
        || resource.resource_type === 'chair'
        || resource.resource_type === 'other'
      ) ? resource.resource_type : 'bed',
      status: (
        resource.status === 'in_use'
        || resource.status === 'maintenance'
        || resource.status === 'inactive'
      ) ? resource.status : 'available',
      capacity: String(parseIntegerInput(resource.capacity, { min: 1, max: 20, fallback: 1 })),
      locationNote: resource.location_note || '',
    });
  };

  const saveBookingResource = async () => {
    setIsSavingResource(true);
    try {
      const payload = {
        name: resourceForm.name,
        resource_type: resourceForm.resourceType,
        status: resourceForm.status,
        capacity: resourceForm.capacity,
        location_note: resourceForm.locationNote,
      };
      const result = resourceForm.id
        ? await updateBookingResource(resourceForm.id, payload)
        : await createBookingResource(payload);

      if (!result.success) throw new Error(result.error);

      toast.success(resourceForm.id ? 'Đã cập nhật tài nguyên đặt lịch' : 'Đã thêm tài nguyên đặt lịch');
      resetResourceForm();
      await loadBookingResources();
    } catch (error) {
      console.error('Save booking resource error:', error);
      toast.error(getErrorMessage(error, 'Không thể lưu tài nguyên đặt lịch'));
    } finally {
      setIsSavingResource(false);
    }
  };

  const removeBookingResource = async (resourceId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tài nguyên đặt lịch này?')) return;

    setLoadingResources(true);
    try {
      const result = await deleteBookingResource(resourceId);
      if (!result.success) throw new Error(result.error);

      toast.success('Đã xóa tài nguyên đặt lịch');
      await loadBookingResources();
      if (resourceForm.id === resourceId) resetResourceForm();
    } catch (error) {
      console.error('Delete booking resource error:', error);
      toast.error(getErrorMessage(error, 'Không thể xóa tài nguyên đặt lịch'));
    } finally {
      setLoadingResources(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa gói dịch vụ này?')) return;

    setIsLoading(true);
    try {
      const result = await deletePackage(id);
      if (result.error) throw new Error(result.error);

      toast.success('Đã xóa gói dịch vụ');
      void loadData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Lỗi khi xóa gói dịch vụ: ' + getErrorMessage(error, 'Lỗi hệ thống khi xóa'));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleServiceStatus = async (service: ServicePackage) => {
    const newStatus: ServiceStatus = service.status === 'active' ? 'inactive' : 'active';
    try {
      const result = await updatePackage(service.id, { status: newStatus });
      if (result.error) throw new Error(result.error);

      toast.success(`Đã chuyển trạng thái sang: ${newStatus === 'active' ? 'Đang hoạt động' : 'Tạm ngưng/Bản nháp'} 🌸`);
      setServices(prev => prev.map(item => item.id === service.id ? { ...item, status: newStatus } : item));
    } catch (error) {
      console.error('Toggle status error:', error);
      toast.error('Không thể cập nhật trạng thái: ' + getErrorMessage(error, 'Lỗi không xác định'));
    }
  };

  const syncDefaultPackages = async () => {
    const activeModule = enabledModules.industrial_cleaning ? 'industrial_cleaning'
      : enabledModules.beauty_spa ? 'beauty_spa'
      : enabledModules.bella_healthcare ? 'bella_healthcare'
      : enabledModules.babycare ? 'babycare'
      : null;

    if (!activeModule) {
      toast.error('Không tìm thấy module ngành kinh doanh nào được kích hoạt.');
      return;
    }

    setIsLoading(true);
    try {
      const defaultPackages = createDefaultPackages(activeModule);
      const existingPackages = await getPackages();

      const existingNames = new Set((existingPackages || []).map(packageRow => packageRow.name));
      const toInsert = defaultPackages.filter(packageRow => !existingNames.has(packageRow.name));

      if (toInsert.length === 0) {
        toast.info('Tất cả các gói mặc định đã tồn tại trong ERP.');
        return;
      }

      for (const packageData of toInsert) {
        const result = await createPackage(packageData);
        if (result.error) throw new Error(result.error);
      }

      toast.success(`Đã đồng bộ ${toInsert.length} gói dịch vụ mặc định thành công! 🎉`);
      void loadData();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Lỗi đồng bộ gói dịch vụ: ' + getErrorMessage(error, 'Lỗi không xác định'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const selectedModuleKey = enabledModules[form.moduleKey]
        ? form.moduleKey
        : getDefaultTenantModuleKey(enabledModules);

      const metadata: JsonObject = {};
      if (form.serviceKind === 'lis_test') {
        metadata.lisCode = form.lisCode || undefined;
        metadata.lisSampleType = form.lisSampleType || undefined;
        metadata.lisTubeColor = form.lisTubeColor || undefined;
      } else if (form.serviceKind === 'ris_imaging') {
        metadata.risCode = form.risCode || undefined;
        metadata.risModality = form.risModality || undefined;
        metadata.risBodySite = form.risBodySite || undefined;
      }

      const dbData: PackageActionInput = {
        name: form.name,
        price: parseMoneyInput(form.price),
        duration: `${form.duration} phút/buổi`,
        total_sessions: parseIntegerInput(form.sessions, { min: 1, max: 100, fallback: 1 }),
        details: form.details.split(',').map(detail => detail.trim()).filter(Boolean),
        offer: form.offer || '',
        ktv_commission: parseMoneyInput(form.ktvCommission),
        status: form.status,
        module_key: selectedModuleKey,
        service_kind: form.serviceKind,
        service_category: form.serviceCategory,
        default_duration_minutes: parseIntegerInput(
          form.defaultDurationMinutes || form.duration,
          { min: 1, max: 1440, fallback: parseIntegerInput(form.duration, { min: 1, max: 1440, fallback: 90 }) },
        ),
        requires_resource: selectedModuleKey === 'beauty_spa' ? form.requiresResource : false,
        default_resource_type: selectedModuleKey === 'beauty_spa' && form.requiresResource
          ? form.defaultResourceType
          : null,
        before_after_required: selectedModuleKey === 'beauty_spa' ? form.beforeAfterRequired : false,
        care_note_template: form.careNoteTemplate,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      };

      let packageId: string | null = null;

      if (modalMode === 'edit' && selectedService) {
        const result = await updatePackage(selectedService.id, dbData);
        if (result.error) throw new Error(result.error);
        packageId = selectedService.id;
        toast.success('Đã cập nhật gói dịch vụ');
      } else {
        const result = await createPackage(dbData);
        if (result.error) throw new Error(result.error);
        packageId = result.data?.id || null;
        if (!packageId) throw new Error('Khong xac dinh duoc ma goi dich vu vua tao');
        toast.success('Đã thêm gói dịch vụ mới');
      }

      if (packageId && materialRows.length > 0) {
        const itemIds = materialRows
          .map(row => row.item_id)
          .filter(Boolean);
        const duplicate = itemIds.find((id, index) => itemIds.indexOf(id) !== index);
        if (duplicate) {
          toast.error('Có vật tư bị trùng trong định mức tiêu hao. Vui lòng kiểm tra lại.');
        } else {
          const payload = materialRows
            .filter(row => row.item_id && parseDecimalInput(row.quantity_per_session, { min: 0 }) > 0)
            .map(row => ({
              item_id: row.item_id,
              quantity_per_session: parseDecimalInput(row.quantity_per_session, { min: 0 }),
            }));
          const res = await upsertPackageMaterials(packageId, payload);
          if (!res.success) {
            toast.error('Lỗi lưu định mức tiêu hao: ' + (res.error || ''));
          } else if (payload.length > 0) {
            toast.success(`Đã lưu ${payload.length} định mức tiêu hao vật tư cho gói`);
          }
        }
      } else if (packageId && modalMode === 'edit' && materialRows.length === 0) {
        await upsertPackageMaterials(packageId, []);
      }

      setIsModalOpen(false);
      resetForm();
      void loadData();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Lỗi khi lưu dữ liệu: ' + getErrorMessage(error, 'Lỗi không xác định'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredServices = useMemo(() => services
    .filter(service => {
      const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
      // Support industrial_cleaning, beauty_spa, and babycare modules
      const normalizedModuleKey = (
        service.module_key === 'beauty_spa' ? 'beauty_spa'
        : service.module_key === 'industrial_cleaning' ? 'industrial_cleaning'
        : service.module_key === 'bella_healthcare' ? 'bella_healthcare'
        : 'babycare'
      );
      const matchesEnabledModule = enabledModules[normalizedModuleKey];
      const matchesModule = matchesEnabledModule && (moduleFilter === 'all' || normalizedModuleKey === moduleFilter);
      const matchesStatus = statusFilter === 'all' || service.status === statusFilter;

      return matchesSearch && matchesModule && matchesStatus;
    })
    .sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return a.name.localeCompare(b.name);
    }), [enabledModules, moduleFilter, searchQuery, services, statusFilter]);

  const totalPages = Math.ceil(filteredServices.length / PAGE_SIZE) || 1;
  const paginatedServices = filteredServices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, filteredServices.length);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return {
    services,
    isLoading,
    isModalOpen,
    setIsModalOpen,
    modalMode,
    selectedService,
    searchQuery,
    setSearchQuery: updateSearchQuery,
    statusFilter,
    setStatusFilter: updateStatusFilter,
    moduleFilter,
    setModuleFilter: updateModuleFilter,
    currentPage,
    name: form.name,
    setName,
    price: form.price,
    setPrice,
    duration: form.duration,
    setDuration,
    sessions: form.sessions,
    setSessions,
    offer: form.offer,
    setOffer,
    details: form.details,
    setDetails,
    ktvCommission: form.ktvCommission,
    setKtvCommission,
    status: form.status,
    setStatus,
    moduleKey: form.moduleKey,
    setModuleKey,
    serviceKind: form.serviceKind,
    setServiceKind,
    serviceCategory: form.serviceCategory,
    setServiceCategory,
    defaultDurationMinutes: form.defaultDurationMinutes,
    setDefaultDurationMinutes,
    requiresResource: form.requiresResource,
    setRequiresResource,
    defaultResourceType: form.defaultResourceType,
    setDefaultResourceType,
    beforeAfterRequired: form.beforeAfterRequired,
    setBeforeAfterRequired,
    careNoteTemplate: form.careNoteTemplate,
    setCareNoteTemplate,
    lisCode: form.lisCode,
    setLisCode,
    lisSampleType: form.lisSampleType,
    setLisSampleType,
    lisTubeColor: form.lisTubeColor,
    setLisTubeColor,
    risCode: form.risCode,
    setRisCode,
    risModality: form.risModality,
    setRisModality,
    risBodySite: form.risBodySite,
    setRisBodySite,
    enabledModules,
    tenantName,
    hasLoadedTenantModules,
    isBeautySpaEnabled,
    bookingResources,
    loadingResources,
    resourceForm,
    setResourceName,
    setResourceType,
    setResourceStatus,
    setResourceCapacity,
    setResourceLocationNote,
    isSavingResource,
    editBookingResource,
    saveBookingResource,
    removeBookingResource,
    resetResourceForm,
    isSubmitting,
    inventoryItems,
    materialRows,
    loadingMaterials,
    filteredServices,
    paginatedServices,
    totalPages,
    startIndex,
    endIndex,
    openAddModal,
    openEditModal,
    addMaterialRow,
    updateMaterialRow,
    removeMaterialRow,
    handleDelete,
    toggleServiceStatus,
    syncDefaultPackages,
    handleSubmit,
    handlePageChange,
    refreshData,
  };
}
