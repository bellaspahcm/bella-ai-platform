'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import { TradeInPhotoService, type PhotoCategory } from '@/modules/bella-auto/services/TradeInPhotoService';
import { Camera, Upload, CheckCircle, AlertCircle, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/types/database.types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type TradeInAppraisalRow = Pick<
  Database['public']['Tables']['auto_trade_in_appraisals']['Row'],
  | 'id'
  | 'customer_id'
  | 'make'
  | 'model'
  | 'variant'
  | 'year'
  | 'color'
  | 'license_plate'
  | 'status'
>;

interface PhotoUploadStatus {
  category: string;
  file: File | null;
  preview: string | null;
  uploaded: boolean;
  uploading: boolean;
  error: string | null;
}

interface TradeInAppraisal {
  id: string;
  customer_name: string;
  vehicle_info: string;
  status: string;
}

function mapTradeInAppraisal(row: TradeInAppraisalRow): TradeInAppraisal {
  const vehicleParts = [
    row.year,
    row.make,
    row.model,
    row.variant,
    row.color,
    row.license_plate,
  ].filter((value): value is string | number => value !== null && value !== undefined && value !== '');

  return {
    id: row.id,
    customer_name: row.customer_id ? `KH ${row.customer_id.slice(0, 8)}` : 'Khách hàng chưa liên kết',
    vehicle_info: vehicleParts.join(' · '),
    status: row.status,
  };
}

export default function TradeInPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appraisals, setAppraisals] = useState<TradeInAppraisal[]>([]);
  const [selectedAppraisal, setSelectedAppraisal] = useState<string | null>(null);
  const [photoStatusAppraisal, setPhotoStatusAppraisal] = useState<string | null>(null);
  const [photoStatusError, setPhotoStatusError] = useState<string | null>(null);
  const [photoCategories, setPhotoCategories] = useState<(PhotoCategory & { count: number; hasPhotos: boolean; isComplete: boolean })[]>([]);
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, PhotoUploadStatus>>({});
  const uploadingPhoto = Object.values(uploadStatuses).some(status => status.uploading);
  const [completionStatus, setCompletionStatus] = useState({
    isComplete: false,
    requiredCategories: [] as string[],
    missingCategories: [] as string[],
    totalPhotos: 0,
  });

  // Fetch appraisals
  useEffect(() => {
    const fetchAppraisals = async () => {
      try {
        const supabase = createClient();
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          setLoadError('Không thể xác thực để tải hồ sơ định giá. Vui lòng tải lại trang để thử lại.');
          toast.error('Không thể xác thực người dùng');
          return;
        }

        // Get user profile with tenant_id
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          setLoadError('Không thể tải hồ sơ định giá của tenant. Vui lòng tải lại trang để thử lại.');
          toast.error('Không tìm thấy thông tin tenant');
          return;
        }
        if (!profile.tenant_id) {
          setLoadError('Tài khoản chưa được gán tenant để tải hồ sơ định giá.');
          toast.error('Tài khoản chưa được gán tenant');
          return;
        }

        // Fetch trade-in appraisals
        const { data, error } = await supabase
          .from('auto_trade_in_appraisals')
          .select('id, customer_id, make, model, variant, year, color, license_plate, status')
          .eq('tenant_id', profile.tenant_id)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        } else {
          setAppraisals((data || []).map(mapTradeInAppraisal));
        }
      } catch (error) {
        setLoadError('Không thể tải danh sách định giá. Vui lòng tải lại trang để thử lại.');
        console.error('Error fetching appraisals:', error);
        toast.error('Không thể tải danh sách định giá');
      } finally {
        setLoading(false);
      }
    };

    void fetchAppraisals();
  }, []);

  // Fetch photo categories and status when appraisal selected
  useEffect(() => {
    let cancelled = false;
    setPhotoStatusAppraisal(null);
    setPhotoStatusError(null);
    const fetchPhotoStatus = async () => {
      if (!selectedAppraisal) return;

      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error('Not authenticated');

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.tenant_id) throw new Error('Tenant not found');

        // Get photo categories with status
        const categories = await TradeInPhotoService.getPhotoCategoriesWithStatus(
          profile.tenant_id,
          selectedAppraisal
        );
        // Get completion status
        const status = await TradeInPhotoService.checkPhotoCompletionStatus(
          profile.tenant_id,
          selectedAppraisal
        );
        if (cancelled) return;
        setPhotoCategories(categories);
        setCompletionStatus(status);
        setPhotoStatusAppraisal(selectedAppraisal);

      } catch (error) {
        if (cancelled) return;
        setPhotoStatusError('Không thể tải trạng thái ảnh. Vui lòng chọn lại hồ sơ để thử lại.');
        console.error('Error fetching photo status:', error);
        toast.error('Không thể tải trạng thái ảnh');
      }
    };

    void fetchPhotoStatus();
    return () => { cancelled = true; };
  }, [selectedAppraisal]);

  // Handle file selection
  const handleFileSelect = useCallback((category: string, file: File) => {
    const preview = URL.createObjectURL(file);
    
    setUploadStatuses(prev => ({
      ...prev,
      [category]: {
        category,
        file,
        preview,
        uploaded: false,
        uploading: false,
        error: null,
      },
    }));
  }, []);

  // Handle file upload
  const handleUpload = useCallback(async (category: string) => {
    const currentStatus = uploadStatuses[category];
    if (!currentStatus?.file || !selectedAppraisal) return;

    const fileToUpload = currentStatus.file;
    let photoPersisted = false;

    setUploadStatuses(prev => {
      return {
        ...prev,
        [category]: { ...currentStatus, uploading: true, error: null },
      };
    });

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) throw new Error('Tenant not found');

      // Upload to Supabase Storage
      const fileName = `${selectedAppraisal}/${category}/${Date.now()}_${fileToUpload.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('trade-in-photos')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('trade-in-photos')
        .getPublicUrl(uploadData.path);

      // Save to database using service
      await TradeInPhotoService.uploadPhoto({
        tenantId: profile.tenant_id,
        appraisalId: selectedAppraisal,
        photoCategory: category,
        photoUrl: publicUrl,
        fileName: fileToUpload.name,
        fileSizeBytes: fileToUpload.size,
        mimeType: fileToUpload.type,
        uploadedBy: user.id,
      });
      photoPersisted = true;

      toast.success(`Đã tải lên ảnh ${TradeInPhotoService.PHOTO_CATEGORIES.find(c => c.key === category)?.label}`);

      // Refresh photo status
      setPhotoStatusAppraisal(null);
      setPhotoStatusError(null);
      const categories = await TradeInPhotoService.getPhotoCategoriesWithStatus(
        profile.tenant_id,
        selectedAppraisal
      );
      const completionResult = await TradeInPhotoService.checkPhotoCompletionStatus(
        profile.tenant_id,
        selectedAppraisal
      );
      setPhotoCategories(categories);
      setCompletionStatus(completionResult);
      setPhotoStatusAppraisal(selectedAppraisal);
      setUploadStatuses(prev => ({
        ...prev,
        [category]: { ...prev[category], uploaded: true, uploading: false },
      }));

    } catch (error: unknown) {
      if (photoPersisted) {
        setPhotoStatusError('Ảnh đã lưu nhưng chưa tải lại được trạng thái ảnh. Vui lòng chọn lại hồ sơ.');
      }
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUploadStatuses(prev => ({
        ...prev,
        [category]: { ...prev[category], uploaded: photoPersisted, uploading: false, error: errorMessage },
      }));
      toast.error(photoPersisted ? 'Ảnh đã lưu nhưng chưa tải lại được trạng thái ảnh' : `Lỗi tải ảnh: ${errorMessage}`);
    }
  }, [selectedAppraisal, uploadStatuses]);


  // Remove photo preview
  const handleRemovePreview = useCallback((category: string) => {
    setUploadStatuses(prev => {
      const status = prev[category];
      if (status?.preview) {
        URL.revokeObjectURL(status.preview);
      }
      const { [category]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  if (loading) {
    return (
      <div role="status" aria-label="Đang tải hồ sơ định giá" className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Thu Cũ Đổi Mới</h1>
          <p className="mt-1 text-sm text-gray-500">
            Quản lý hình ảnh và định giá xe thu cũ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-cyan-600" />
          <span className="text-sm font-medium text-gray-700">
            {selectedAppraisal && photoStatusAppraisal === selectedAppraisal ? completionStatus.totalPhotos : '—'} ảnh đã tải lên
          </span>
        </div>
      </div>

      {/* Appraisal Selection */}
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Không tải được hồ sơ định giá</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : appraisals.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Chưa có hồ sơ định giá
          </h3>
          <p className="text-gray-500 mb-6">
            Chức năng tạo hồ sơ định giá chưa sẵn sàng trên màn hình này.
          </p>
          <button
            disabled
            aria-describedby="trade-in-create-unavailable"
            className="px-6 py-2 bg-cyan-600 text-white rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            Tạo hồ sơ định giá
          </button>
          <p id="trade-in-create-unavailable" className="mt-3 text-sm text-gray-500">Chưa thể tạo hồ sơ mới. Tính năng tải ảnh vẫn dùng được khi đã có hồ sơ định giá.</p>
        </div>
      ) : (
        <>
          {/* Appraisal Selector */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label htmlFor="trade-in-appraisal" className="block text-sm font-medium text-gray-700 mb-2">
              Chọn hồ sơ định giá
            </label>
            <select
              id="trade-in-appraisal"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              value={selectedAppraisal || ''}
              disabled={uploadingPhoto}
              onChange={(e) => {
                Object.values(uploadStatuses).forEach(status => {
                  if (status.preview) URL.revokeObjectURL(status.preview);
                });
                setUploadStatuses({});
                setPhotoStatusAppraisal(null);
                setPhotoStatusError(null);
                setSelectedAppraisal(e.target.value || null);
              }}
            >
              <option value="">-- Chọn hồ sơ --</option>
              {appraisals.map(appraisal => (
                <option key={appraisal.id} value={appraisal.id}>
                  {appraisal.customer_name} - {appraisal.vehicle_info} ({appraisal.status})
                </option>
              ))}
            </select>
          </div>

          {/* Completion Status */}
          {selectedAppraisal && photoStatusAppraisal !== selectedAppraisal && (
            photoStatusError ? (
              <Alert variant="destructive">
                <AlertTitle>Không tải được trạng thái ảnh</AlertTitle>
                <AlertDescription>{photoStatusError}</AlertDescription>
              </Alert>
            ) : (
              <div role="status" className="rounded-lg border p-4 text-gray-600">Đang tải trạng thái ảnh...</div>
            )
          )}
          {selectedAppraisal && photoStatusAppraisal === selectedAppraisal && (
            <div className={`rounded-lg border p-4 ${completionStatus.isComplete ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-center gap-2">
                {completionStatus.isComplete ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                )}
                <span className={`font-semibold ${completionStatus.isComplete ? 'text-green-900' : 'text-yellow-900'}`}>
                  {completionStatus.isComplete
                    ? 'Đã hoàn thành đầy đủ ảnh bắt buộc'
                    : `Còn thiếu ${completionStatus.missingCategories.length} danh mục ảnh bắt buộc`
                  }
                </span>
              </div>
              {!completionStatus.isComplete && (
                <div className="mt-2 text-sm text-yellow-800">
                  Cần chụp: {completionStatus.missingCategories
                    .map(cat => TradeInPhotoService.PHOTO_CATEGORIES.find(c => c.key === cat)?.label)
                    .join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Photo Upload Grid */}
          {selectedAppraisal && photoStatusAppraisal === selectedAppraisal && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {photoCategories.map(category => {
                const status = uploadStatuses[category.key];
                const isUploaded = category.hasPhotos || status?.uploaded;

                return (
                  <div
                    key={category.key}
                    className={`bg-white rounded-lg border-2 p-4 transition-all ${
                      category.required && !isUploaded
                        ? 'border-red-200 bg-red-50'
                        : isUploaded
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          {category.label}
                          {category.required && (
                            <span className="text-red-500 text-xs">*</span>
                          )}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {category.description}
                        </p>
                      </div>
                      {isUploaded && (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
                    </div>

                    {/* Current photo count */}
                    {category.count > 0 && (
                      <div className="text-xs text-gray-600 mb-2">
                        {category.count}/{category.maxPhotos} ảnh
                      </div>
                    )}

                    {/* Preview or Upload */}
                    {status?.preview ? (
                      <div className="relative">
                        <img
                          src={status.preview}
                          alt={category.label}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => handleRemovePreview(category.key)}
                          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                          disabled={uploadingPhoto}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="block w-full h-48 border-2 border-dashed border-gray-300 rounded-lg hover:border-cyan-500 cursor-pointer transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(category.key, file);
                          }}
                          disabled={uploadingPhoto || category.count >= category.maxPhotos}
                        />
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                          <Upload className="w-8 h-8 mb-2" />
                          <span className="text-sm">Chọn ảnh</span>
                        </div>
                      </label>
                    )}

                    {/* Upload button */}
                    {status?.file && !status.uploaded && (
                      <button
                        onClick={() => handleUpload(category.key)}
                        disabled={uploadingPhoto}
                        className="w-full mt-3 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {status.uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Đang tải lên...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Tải lên
                          </>
                        )}
                      </button>
                    )}

                    {/* Error */}
                    {status?.error && (
                      <div className="mt-2 text-xs text-red-600">
                        {status.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
