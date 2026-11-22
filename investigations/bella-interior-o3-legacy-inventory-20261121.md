# Bella Interior — đối soát ảnh O3 cũ (nội bộ)

> Nội bộ. Không commit/publish bảng này nếu chưa rà soát dữ liệu. Bảng được lập từ Production read-only ngày 2026-11-21. Không tải, sao chép, thay thế hoặc xóa file.

- Production DB ref: `lvnvkpyxtuilhrabtlwv`
- Phạm vi: 4 URL HTTPS đang nằm trong `interior_site_diaries.photo_urls` của 2 nhật ký.
- Quyền sở hữu file nguồn: **NOT PROVEN**. `tenant_id`/`project_id` bên dưới chỉ chứng minh ngữ cảnh hồ sơ Bella, không chứng minh quyền sở hữu URL bên ngoài.
- Khả năng truy cập hiện tại: **NOT CHECKED**. Không gửi request ra host bên ngoài và không tải nội dung.
- Quyết định tạm thời: giữ URL/tham chiếu hiện hành để đối soát; không tự động chuyển sang Supabase Storage. Chỉ quyết định giữ ngoài hay chuyển sau khi xác minh nguồn sở hữu, quyền sử dụng và yêu cầu hợp đồng.

| Nhật ký | Vị trí | Tenant | Project | Project thuộc tenant | URL hiện trạng | Chủ sở hữu nguồn | Khả năng truy cập | Quyết định |
|---|---:|---|---|---|---|---|---|---|
| `d1a2b3c4-1111-4000-8000-000000000001` | 1 | `686884d2-6a4a-4581-ac8f-6ae69666b31d` | `d450fc00-a593-484f-a8ad-ff8aebf756df` | Có | <https://storage.bella.vn/interior/INT-2024-004/delivery_sofa_01.jpg> | Chưa xác minh | Chưa gửi request | Giữ tham chiếu; không tự tải/chuyển; chờ xác minh nguồn và quyền sử dụng |
| `d1a2b3c4-1111-4000-8000-000000000001` | 2 | `686884d2-6a4a-4581-ac8f-6ae69666b31d` | `d450fc00-a593-484f-a8ad-ff8aebf756df` | Có | <https://storage.bella.vn/interior/INT-2024-004/delivery_table_01.jpg> | Chưa xác minh | Chưa gửi request | Giữ tham chiếu; không tự tải/chuyển; chờ xác minh nguồn và quyền sử dụng |
| `d1a2b3c4-2222-4000-8000-000000000002` | 1 | `686884d2-6a4a-4581-ac8f-6ae69666b31d` | `d450fc00-a593-484f-a8ad-ff8aebf756df` | Có | <https://storage.bella.vn/interior/INT-2024-004/installed_sofa_livingroom.jpg> | Chưa xác minh | Chưa gửi request | Giữ tham chiếu; không tự tải/chuyển; chờ xác minh nguồn và quyền sử dụng |
| `d1a2b3c4-2222-4000-8000-000000000002` | 2 | `686884d2-6a4a-4581-ac8f-6ae69666b31d` | `d450fc00-a593-484f-a8ad-ff8aebf756df` | Có | <https://storage.bella.vn/interior/INT-2024-004/installed_table_dining.jpg> | Chưa xác minh | Chưa gửi request | Giữ tham chiếu; không tự tải/chuyển; chờ xác minh nguồn và quyền sử dụng |
