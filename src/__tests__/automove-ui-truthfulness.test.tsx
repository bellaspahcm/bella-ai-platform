/** @jest-environment jsdom */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LeadCenterPage from '@/app/dashboard/bella-auto/leads/page';
import CustomerJourneyPage from '@/app/dashboard/bella-auto/journeys/page';
import WorkshopPage from '@/app/dashboard/bella-auto/workshop/page';
import TradeInPage from '@/app/dashboard/bella-auto/trade-in/page';
import { ExperienceDashboard } from '@/components/bella-auto/experience/ExperienceDashboard';
import type { UploadPhotoData } from '@/modules/bella-auto/services/TradeInPhotoService';

// Explicit boundary fixtures verify presentation behavior, not live persistence.
interface ListResponse {
  data: Record<string, unknown>[] | null;
  error: { message: string; code: string } | null;
}
interface AuthResponse {
  data: { user: { id: string } | null };
  error: { message: string } | null;
}
interface ProfileResponse {
  data: { tenant_id: string | null } | null;
  error: { message: string } | null;
}
interface PhotoStatus {
  key: string;
  label: string;
  description: string;
  required: boolean;
  maxPhotos: number;
  count: number;
  hasPhotos: boolean;
  isComplete: boolean;
}
interface CompletionStatus {
  isComplete: boolean;
  requiredCategories: string[];
  missingCategories: string[];
  totalPhotos: number;
}

let mockResponses: Record<string, Promise<ListResponse>>;
const mockRead = jest.fn((table: string) => mockResponses[table] ?? Promise.resolve({ data: [], error: null }));
const mockEq = jest.fn<void, [string, unknown]>();
const mockGetUser = jest.fn<Promise<AuthResponse>, []>();
const mockProfile = jest.fn<Promise<ProfileResponse>, []>();
const mockSuccess = jest.fn();
const mockError = jest.fn();
const mockInfo = jest.fn();
const mockPhotoCategories = jest.fn<Promise<PhotoStatus[]>, [string, string]>();
const mockPhotoCompletion = jest.fn<Promise<CompletionStatus>, [string, string]>();
const mockUploadPhoto = jest.fn<Promise<{ id: string }>, [UploadPhotoData]>();
const mockStorageUpload = jest.fn(async () => ({ data: { path: 'fixture/photo.jpg' }, error: null }));
const mockFrom = jest.fn((table: string) => ({
  select: (_columns: string, options?: { head?: boolean }) => {
    if (options?.head) {
      return {
        eq: (column: string, value: unknown) => {
          mockEq(column, value);
          return Promise.resolve({ count: 1, error: null });
        },
      };
    }
    if (table === 'users') {
      return {
        eq: (column: string, value: unknown) => {
          mockEq(column, value);
          return { single: mockProfile };
        },
      };
    }
    return {
      order: () => mockRead(table),
      eq: (column: string, value: unknown) => {
        mockEq(column, value);
        return { order: () => mockRead(table) };
      },
    };
  },
}));

jest.mock('@/lib/supabase-client', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        getPublicUrl: () => ({ data: { publicUrl: 'https://fixture.invalid/photo.jpg' } }),
      }),
    },
  }),
}));
jest.mock('@/core/hooks/useTenantContext', () => ({
  useTenantContext: () => ({ tenantId: 'tenant-fixture' }),
}));
jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockSuccess(...args),
    error: (...args: unknown[]) => mockError(...args),
    info: (...args: unknown[]) => mockInfo(...args),
  },
}));
jest.mock('@/modules/bella-auto/services/TradeInPhotoService', () => ({
  TradeInPhotoService: {
    PHOTO_CATEGORIES: [{ key: 'front', label: 'Mặt trước', description: 'Ảnh phía trước', required: true, maxPhotos: 1 }],
    getPhotoCategoriesWithStatus: (tenantId: string, appraisalId: string) => mockPhotoCategories(tenantId, appraisalId),
    checkPhotoCompletionStatus: (tenantId: string, appraisalId: string) => mockPhotoCompletion(tenantId, appraisalId),
    uploadPhoto: (data: UploadPhotoData) => mockUploadPhoto(data),
  },
}));

const leadFixture = {
  id: 'lead-fixture', status: 'new', source: 'Website Bella', created_at: '2026-10-23T03:00:00Z',
  preferred_color: 'Xanh', budget_limit: 900000000, assigned_sales_agent_id: null,
  customers: { name_mother: 'Lead boundary fixture', phone: '0900000011' },
  auto_variants: { name: 'Vehicle fixture', year: 2026 }, users: null,
};
const appraisalFixture = {
  id: 'appraisal-fixture', customer_id: 'customer-fixture', make: 'Vehicle', model: 'Fixture',
  variant: 'Base', year: 2026, color: 'Xanh', license_plate: 'FIXTURE', status: 'draft',
};

function deferredList() {
  let resolve: (response: ListResponse) => void = () => { throw new Error('Deferred not initialized'); };
  const promise = new Promise<ListResponse>(done => { resolve = done; });
  return { promise, resolve };
}

function deferredCompletion() {
  let resolve: (response: CompletionStatus) => void = () => { throw new Error('Deferred not initialized'); };
  let reject: (reason: Error) => void = () => { throw new Error('Deferred not initialized'); };
  const promise = new Promise<CompletionStatus>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResponses = {};
  mockGetUser.mockResolvedValue({ data: { user: { id: 'actor-fixture' } }, error: null });
  mockProfile.mockResolvedValue({ data: { tenant_id: 'tenant-fixture' }, error: null });
  mockPhotoCategories.mockResolvedValue([
    { key: 'front', label: 'Mặt trước', description: 'Ảnh phía trước', required: true, maxPhotos: 1, count: 0, hasPhotos: false, isComplete: false },
  ]);
  mockPhotoCompletion.mockResolvedValue({ isComplete: false, requiredCategories: ['front'], missingCategories: ['front'], totalPhotos: 0 });
  mockUploadPhoto.mockResolvedValue({ id: 'photo-fixture' });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:fixture') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
});

describe('AutoMove truthful operational UI', () => {
  it('keeps lead totals unknown while pending and distinguishes a successful empty read', async () => {
    const pending = deferredList();
    mockResponses.auto_leads = pending.promise;
    render(<LeadCenterPage />);
    expect(screen.getByText('Đang tải leads...')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.queryByText('Không tìm thấy lead nào')).not.toBeInTheDocument();

    await act(async () => { pending.resolve({ data: [], error: null }); });
    expect(await screen.findByText('Không tìm thấy lead nào')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.queryByText('Không tải được dữ liệu lead')).not.toBeInTheDocument();
  });

  it.each(['query error', 'rejected query'])('shows lead %s without successful empty or zero totals', async failure => {
    const pending = deferredList();
    mockResponses.auto_leads = pending.promise;
    if (failure === 'rejected query') mockRead.mockRejectedValueOnce(new Error('Fixture transport failure'));
    render(<LeadCenterPage />);
    if (failure === 'query error') {
      await act(async () => { pending.resolve({ data: null, error: { code: '42501', message: 'Fixture denied' } }); });
    }
    expect(await screen.findByText('Không tải được dữ liệu lead')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.queryByText('Không tìm thấy lead nào')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it('preserves lead projection, search and status filters; unavailable assignment cannot report success', async () => {
    mockResponses.auto_leads = Promise.resolve({ data: [leadFixture], error: null });
    render(<LeadCenterPage />);
    expect(await screen.findByText('Lead boundary fixture')).toBeInTheDocument();
    expect(screen.getByText('Vehicle fixture 2026')).toBeInTheDocument();
    expect(screen.getByText('0900000011')).toBeInTheDocument();
    expect(screen.getByText(/Màu: Xanh/)).toBeInTheDocument();
    expect(mockRead).toHaveBeenCalledWith('auto_leads');

    for (const label of ['Phân bổ xoay vòng', 'Phân bổ thông minh AI']) {
      const control = screen.getByRole('button', { name: label });
      expect(control).toBeDisabled();
      expect(control).toHaveAccessibleDescription('Chưa thể phân bổ lead từ màn hình này.');
      fireEvent.click(control);
    }
    expect(mockSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('Mới Nhận')).toBeInTheDocument();
    expect(screen.queryByText('Engine đang hoạt động')).not.toBeInTheDocument();
    expect(screen.queryByText('Trần Minh Quân')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm lead' }), { target: { value: 'not-present' } });
    expect(screen.queryByText('Lead boundary fixture')).not.toBeInTheDocument();
    expect(screen.getByText('Không tìm thấy lead nào')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm lead' }), { target: { value: '0900000011' } });
    expect(screen.getByText('Lead boundary fixture')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Lọc trạng thái lead' }), { target: { value: 'won' } });
    expect(screen.queryByText('Lead boundary fixture')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Lọc trạng thái lead' }), { target: { value: 'all' } });
    expect(screen.getByText('Lead boundary fixture')).toBeInTheDocument();
    expect(mockRead).toHaveBeenCalledTimes(1);
  });

  it('keeps all Journey views and the SLA action visible without invented results or stage deadlines', () => {
    render(<CustomerJourneyPage />);
    expect(screen.getByRole('heading', { name: 'Hành Trình Khách Hàng & SLA Engine' })).toBeInTheDocument();
    const scan = screen.getByRole('button', { name: 'Quét & Đồng Bộ SLA' });
    expect(scan).toBeDisabled();
    expect(scan).toHaveAccessibleDescription(/chưa được kết nối/);
    fireEvent.click(scan);

    for (const [label, detail] of [
      ['Phễu Chuyển Đổi', /Phễu chuyển đổi chưa kết nối/],
      ['Biểu Đồ Tắc Nghẽn', /Biểu đồ tắc nghẽn chưa kết nối/],
      ['Timeline CEO View', /Timeline chưa kết nối/],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(within(screen.getByRole('region', { name: label })).getByText(detail)).toBeInTheDocument();
      expect(screen.queryByText(/320|91h|22 Giai đoạn|Nguyễn Văn A|Vương Đình H/)).not.toBeInTheDocument();
    }
    const customerSelector = screen.getByRole('combobox', { name: 'Xem hành trình' });
    expect(customerSelector).toBeDisabled();
    expect(customerSelector).toHaveAccessibleDescription(/Timeline chưa kết nối/);
    expect(mockSuccess).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('keeps Experience tabs and refresh visible without synthetic metrics, actions or refresh timestamps', async () => {
    render(<ExperienceDashboard />);
    const refresh = screen.getByRole('button', { name: 'Làm mới dữ liệu' });
    expect(refresh).toBeDisabled();
    expect(refresh).toHaveAccessibleDescription(/chưa kết nối nguồn dữ liệu vận hành/);
    fireEvent.click(refresh);
    expect(screen.getByText('Chưa cập nhật')).toBeInTheDocument();

    for (const [label, detail, action] of [
      ['Tổng quan', /Chỉ số tổng quan và xu hướng trải nghiệm/, null],
      ['NPS', /Chưa kết nối kết quả khảo sát NPS/, 'Gọi ngay'],
      ['CSI', /Chưa kết nối kết quả khảo sát CSI/, 'Liên hệ khắc phục'],
      ['Sức khỏe KH', /Chưa có dữ liệu vận hành để xác định điểm sức khỏe/, 'Tạo kế hoạch chăm sóc'],
      ['Hành động', /Next Best Actions và Lost Analysis chưa kết nối/, 'Thực hiện'],
    ] as const) {
      fireEvent.click(screen.getByRole('tab', { name: label }));
      await waitFor(() => expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true'));
      expect(within(screen.getByRole('tabpanel')).getByText(detail)).toBeInTheDocument();
      expect(screen.queryByText(/\+42|142 khảo sát|86% hài lòng|8 ưu tiên cao/)).not.toBeInTheDocument();
      if (action) {
        const control = screen.getByRole('button', { name: action });
        expect(control).toBeDisabled();
        expect(control).toHaveAccessibleDescription(detail);
        fireEvent.click(control);
      }
    }
    expect(mockSuccess).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('retains workshop appointment and repair-order reads while technicians explicitly remain unavailable', async () => {
    const scheduled = new Date();
    scheduled.setHours(10, 0, 0, 0);
    mockResponses.auto_service_appointments = Promise.resolve({ data: [{
      id: 'appointment-fixture', appointment_number: 'APT-FIXTURE', customer_name: 'Workshop customer fixture',
      vehicle_info: 'Workshop vehicle fixture - FIXTURE', scheduled_date: scheduled.toISOString(),
      description: 'Workshop service fixture', status: 'confirmed', estimated_duration_hours: 1,
    }], error: null });
    mockResponses.auto_repair_orders = Promise.resolve({ data: [{
      id: 'order-fixture', order_number: 'RO-FIXTURE', customer_name: 'Workshop order fixture',
      vehicle_info: 'Workshop vehicle fixture - FIXTURE', order_type: 'repair', status: 'open',
      opened_at: scheduled.toISOString(), estimated_hours: 1,
    }], error: null });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      render(<WorkshopPage />);
      expect(await screen.findByText('Workshop customer fixture')).toBeInTheDocument();
      expect(mockRead).toHaveBeenCalledWith('auto_service_appointments');
      expect(mockRead).toHaveBeenCalledWith('auto_repair_orders');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-fixture');
      fireEvent.click(screen.getByRole('button', { name: 'Bảng Sửa Chữa' }));
      expect(screen.getByText('RO-FIXTURE')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Kỹ Thuật Viên' }));
      expect(screen.getByText('Dữ liệu kỹ thuật viên chưa sẵn sàng')).toBeInTheDocument();
      expect(screen.queryByText(/Kỹ thuật viên [XYZ]|Hiệu suất trung bình|Tổng kỹ thuật viên/)).not.toBeInTheDocument();
      expect(mockSuccess).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Lịch Hẹn' }));
      expect(screen.getByText('Workshop customer fixture')).toBeInTheDocument();
    } finally { log.mockRestore(); }
  });

  it('does not claim a trade-in empty result while its list is pending', async () => {
    const pending = deferredList();
    mockResponses.auto_trade_in_appraisals = pending.promise;
    render(<TradeInPage />);
    expect(screen.getByRole('status', { name: 'Đang tải hồ sơ định giá' })).toBeInTheDocument();
    expect(screen.queryByText('Chưa có hồ sơ định giá')).not.toBeInTheDocument();
    await act(async () => { pending.resolve({ data: [], error: null }); });
    expect(await screen.findByText('Chưa có hồ sơ định giá')).toBeInTheDocument();
    const create = screen.getByRole('button', { name: 'Tạo hồ sơ định giá' });
    expect(create).toBeDisabled();
    expect(create).toHaveAccessibleDescription(/Chưa thể tạo hồ sơ mới/);
    expect(screen.getByText('— ảnh đã tải lên')).toBeInTheDocument();
    fireEvent.click(create);
    expect(mockInfo).not.toHaveBeenCalled();
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it.each(['read error', 'auth error'])('does not convert trade-in %s into an empty list', async failure => {
    mockResponses.auto_trade_in_appraisals = Promise.resolve({ data: null, error: { code: '42501', message: 'Fixture denied' } });
    if (failure === 'auth error') mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Fixture auth denied' } });
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<TradeInPage />);
      expect(await screen.findByText('Không tải được hồ sơ định giá')).toBeInTheDocument();
      expect(screen.queryByText('Chưa có hồ sơ định giá')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Tạo hồ sơ định giá' })).not.toBeInTheDocument();
      expect(screen.getByText('— ảnh đã tải lên')).toBeInTheDocument();
      expect(mockSuccess).not.toHaveBeenCalled();
    } finally { errorLog.mockRestore(); }
  });

  it('retains the existing selected-appraisal photo read and upload path', async () => {
    const pendingStatus = new Promise<CompletionStatus>(() => {});
    mockResponses.auto_trade_in_appraisals = Promise.resolve({ data: [appraisalFixture], error: null });
    mockPhotoCompletion.mockReturnValueOnce(pendingStatus);
    const first = render(<TradeInPage />);
    const selector = await screen.findByRole('combobox');
    fireEvent.change(selector, { target: { value: 'appraisal-fixture' } });
    await waitFor(() => expect(mockPhotoCategories).toHaveBeenCalledWith('tenant-fixture', 'appraisal-fixture'));
    expect(screen.getByText('— ảnh đã tải lên')).toBeInTheDocument();
    expect(screen.getByText('Đang tải trạng thái ảnh...')).toBeInTheDocument();
    expect(screen.queryByText(/Còn thiếu 0/)).not.toBeInTheDocument();
    expect(screen.queryByText('Đã hoàn thành đầy đủ ảnh bắt buộc')).not.toBeInTheDocument();
    expect(first.container.querySelector('input[type="file"]')).toBeNull();
    first.unmount();

    const page = render(<TradeInPage />);
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'appraisal-fixture' } });
    expect(await screen.findByText('0 ảnh đã tải lên')).toBeInTheDocument();
    const input = page.container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Photo input unavailable');
    const photo = new File(['fixture'], 'front.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [photo] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Tải lên' }));
    await waitFor(() => expect(mockUploadPhoto).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-fixture', appraisalId: 'appraisal-fixture', photoCategory: 'front',
      photoUrl: 'https://fixture.invalid/photo.jpg', uploadedBy: 'actor-fixture',
    })));
    expect(mockStorageUpload).toHaveBeenCalledWith(expect.stringContaining('/front/'), photo, { cacheControl: '3600', upsert: false });
    expect(mockSuccess).toHaveBeenCalledWith('Đã tải lên ảnh Mặt trước');
  });

  it('keeps photo totals and completion unknown after a failed status read', async () => {
    mockResponses.auto_trade_in_appraisals = Promise.resolve({ data: [appraisalFixture], error: null });
    const pending = deferredCompletion();
    mockPhotoCompletion.mockReturnValueOnce(pending.promise);
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const page = render(<TradeInPage />);
      fireEvent.change(await screen.findByRole('combobox'), { target: { value: appraisalFixture.id } });
      await waitFor(() => expect(mockPhotoCompletion).toHaveBeenCalled());
      await act(async () => { pending.reject(new Error('Fixture status denied')); });
      expect(await screen.findByText('Không tải được trạng thái ảnh')).toBeInTheDocument();
      expect(screen.getByText('— ảnh đã tải lên')).toBeInTheDocument();
      expect(screen.queryByText(/Còn thiếu 0|Đã hoàn thành đầy đủ ảnh bắt buộc/)).not.toBeInTheDocument();
      expect(page.container.querySelector('input[type="file"]')).toBeNull();
      expect(mockSuccess).not.toHaveBeenCalled();
    } finally { errorLog.mockRestore(); }
  });

  it.each(['auth', 'profile'])('shows photo %s failure as unavailable rather than permanent loading', async failure => {
    mockResponses.auto_trade_in_appraisals = Promise.resolve({ data: [appraisalFixture], error: null });
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<TradeInPage />);
      const selector = await screen.findByRole('combobox');
      if (failure === 'auth') mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
      else mockProfile.mockResolvedValueOnce({ data: null, error: { message: 'Fixture profile denied' } });
      fireEvent.change(selector, { target: { value: appraisalFixture.id } });
      expect(await screen.findByText('Không tải được trạng thái ảnh')).toBeInTheDocument();
      expect(screen.queryByText('Đang tải trạng thái ảnh...')).not.toBeInTheDocument();
      expect(screen.getByText('— ảnh đã tải lên')).toBeInTheDocument();
      expect(mockPhotoCategories).not.toHaveBeenCalled();
    } finally { errorLog.mockRestore(); }
  });

  it('ignores late photo reads from the previous appraisal and resets readiness on returning', async () => {
    const second = { ...appraisalFixture, id: 'appraisal-second' };
    mockResponses.auto_trade_in_appraisals = Promise.resolve({ data: [appraisalFixture, second], error: null });
    const firstRead = deferredCompletion();
    const secondRead = deferredCompletion();
    const returningRead = deferredCompletion();
    mockPhotoCompletion.mockReturnValueOnce(firstRead.promise).mockReturnValueOnce(secondRead.promise).mockReturnValueOnce(returningRead.promise);
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<TradeInPage />);
      const selector = await screen.findByRole('combobox');
      fireEvent.change(selector, { target: { value: appraisalFixture.id } });
      await waitFor(() => expect(mockPhotoCompletion).toHaveBeenCalledTimes(1));
      fireEvent.change(selector, { target: { value: second.id } });
      await waitFor(() => expect(mockPhotoCompletion).toHaveBeenCalledTimes(2));
      await act(async () => { secondRead.resolve({ isComplete: false, requiredCategories: ['front'], missingCategories: ['front'], totalPhotos: 2 }); });
      expect(await screen.findByText('2 ảnh đã tải lên')).toBeInTheDocument();
      await act(async () => { firstRead.resolve({ isComplete: true, requiredCategories: ['front'], missingCategories: [], totalPhotos: 99 }); });
      expect(screen.getByText('2 ảnh đã tải lên')).toBeInTheDocument();
      expect(screen.queryByText('Đã hoàn thành đầy đủ ảnh bắt buộc')).not.toBeInTheDocument();
      fireEvent.change(selector, { target: { value: appraisalFixture.id } });
      await waitFor(() => expect(mockPhotoCompletion).toHaveBeenCalledTimes(3));
      expect(screen.getByText('— ảnh đã tải lên')).toBeInTheDocument();
      await act(async () => { returningRead.reject(new Error('Fixture read denied')); });
      expect(await screen.findByText('Không tải được trạng thái ảnh')).toBeInTheDocument();
      expect(screen.queryByText('99 ảnh đã tải lên')).not.toBeInTheDocument();
    } finally { errorLog.mockRestore(); }
  });

  it('clears appraisal-specific previews when changing selection', async () => {
    mockResponses.auto_trade_in_appraisals = Promise.resolve({ data: [appraisalFixture, { ...appraisalFixture, id: 'appraisal-second' }], error: null });
    const page = render(<TradeInPage />);
    const selector = await screen.findByRole('combobox');
    fireEvent.change(selector, { target: { value: appraisalFixture.id } });
    expect(await screen.findByText('0 ảnh đã tải lên')).toBeInTheDocument();
    const input = page.container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Photo input unavailable');
    fireEvent.change(input, { target: { files: [new File(['fixture'], 'front.jpg', { type: 'image/jpeg' })] } });
    expect(screen.getByRole('button', { name: 'Tải lên' })).toBeInTheDocument();
    fireEvent.change(selector, { target: { value: 'appraisal-second' } });
    expect(await screen.findByText('0 ảnh đã tải lên')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tải lên' })).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture');
    expect(mockUploadPhoto).not.toHaveBeenCalled();
  });

  it('locks selection during upload and reports persisted photos separately from refresh failure', async () => {
    mockResponses.auto_trade_in_appraisals = Promise.resolve({ data: [appraisalFixture], error: null });
    const pendingRefresh = deferredCompletion();
    mockPhotoCompletion.mockResolvedValueOnce({ isComplete: false, requiredCategories: ['front'], missingCategories: ['front'], totalPhotos: 0 }).mockReturnValueOnce(pendingRefresh.promise);
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const page = render(<TradeInPage />);
      const selector = await screen.findByRole('combobox');
      fireEvent.change(selector, { target: { value: appraisalFixture.id } });
      expect(await screen.findByText('0 ảnh đã tải lên')).toBeInTheDocument();
      const input = page.container.querySelector('input[type="file"]');
      if (!(input instanceof HTMLInputElement)) throw new Error('Photo input unavailable');
      fireEvent.change(input, { target: { files: [new File(['fixture'], 'front.jpg', { type: 'image/jpeg' })] } });
      fireEvent.click(screen.getByRole('button', { name: 'Tải lên' }));
      expect(selector).toBeDisabled();
      await waitFor(() => expect(mockPhotoCompletion).toHaveBeenCalledTimes(2));
      expect(screen.getByText('— ảnh đã tải lên')).toBeInTheDocument();
      expect(selector).toBeDisabled();
      await act(async () => { pendingRefresh.reject(new Error('Fixture refresh denied')); });
      expect(await screen.findByText('Không tải được trạng thái ảnh')).toBeInTheDocument();
      expect(screen.getByText('Ảnh đã lưu nhưng chưa tải lại được trạng thái ảnh. Vui lòng chọn lại hồ sơ.')).toBeInTheDocument();
      expect(selector).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Tải lên' })).not.toBeInTheDocument();
      expect(mockSuccess).toHaveBeenCalledWith('Đã tải lên ảnh Mặt trước');
      expect(mockError).toHaveBeenCalledWith('Ảnh đã lưu nhưng chưa tải lại được trạng thái ảnh');
      expect(mockUploadPhoto).toHaveBeenCalledTimes(1);
    } finally { errorLog.mockRestore(); }
  });
});
