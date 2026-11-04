# F09 — kiểm tra quyền ghi trực tiếp trong Supabase local

Ngày: 2026-11-02, khoảng 14:43 Asia/Saigon. Trạng thái: **SCOPED LOCAL RESULT; Production và PostgREST NOT_PROVEN**.

## Phạm vi và nguồn

Theo yêu cầu owner, sử dụng stack đang chạy `bella-preschool-532b3b8a`, container `e981480aea7809a19969471f54275f719dc5afa995587aae903764a0a6b9ed45`, database `postgres`, PostgreSQL 17.6. Nhãn và receipt xác định đây là profile disposable TeacherAttendance, không phải môi trường Production. Source checkout `ed9d60eb843809404fb6ebb3a6f9ed110fbd08bc`. Hai bảng menu chưa tồn tại trước khi chạy. Đây là schema selective của profile khác, không phải bản sao catalog Production.

Trong **một transaction rollback**, áp dụng nội dung hai migration source hiện có, không thay migration ledger, không ghi thêm grants hoặc thay source:

- `20261020110000_p43_preschool_weekly_menu.sql`: SHA-256 `4e4050e4747e1890d48e7a64af2143b5d3f183d1c3d54401732ab3c300e50b69`.
- `20261031153000_preschool_weekly_menu_rls_enhancement.sql`: SHA-256 `c07076c92235c0783226d26f3b909e106c00bddc35560ae8065a20650f7f9f4c`. Bỏ riêng dòng `BEGIN;` và `COMMIT;` của file trong bộ nhớ để giữ nguyên transaction rollback bên ngoài; các câu policy được chạy nguyên nội dung.

Tạo tenant/user `admin_staff` tổng hợp và một master menu fixture trong transaction, sau đó `SET LOCAL ROLE authenticated` và set `request.jwt.claim.sub` / `request.jwt.claims` thành synthetic subject. `auth.uid()` và `get_auth_tenant_id()` xác nhận subject/tenant khớp fixture. Không dùng service role để thử INSERT. Test này mô phỏng PostgreSQL role và claims, **không xác minh đăng nhập Auth thật hay PostgREST HTTP**.

## Kết quả catalog và thực thi

| Kiểm tra | Kết quả |
| --- | --- |
| Owner hai bảng | `postgres` |
| RLS | enabled trên cả hai; FORCE RLS false |
| Policy | mỗi bảng có `tenant_isolation_*`, `FOR ALL`, roles `{public}`, `USING` và `WITH CHECK` theo `get_auth_tenant_id()`, current tenant setting hoặc service role |
| `has_table_privilege('authenticated', ..., INSERT/UPDATE/DELETE)` | false cho cả ba quyền trên cả hai bảng |
| INSERT trực tiếp master với authenticated Staff cùng tenant | **DENIED, SQLSTATE 42501** |
| INSERT trực tiếp day với authenticated Staff cùng tenant | **DENIED, SQLSTATE 42501** |
| Kết thúc | `ROLLBACK`; `to_regclass` xác nhận cả hai bảng không tồn tại sau rollback |

Không chạy UPDATE/DELETE thực tế; kết quả với hai thao tác đó chỉ là catalog privilege check. Không kiểm tra vai trò khác, column grants, alternate functions/views, PostgREST, grants sau migration khác, hay trigger/policy của môi trường khác. Table owner và default privileges phụ thuộc migration executor và môi trường; profile này có default privileges khác cho `postgres` và `supabase_admin`.

## Kết luận và giới hạn

Trong cấu hình local được dựng bằng `postgres` và hai migration nêu trên, direct INSERT của caller authenticated tổng hợp **bị chặn ở tầng table grants**. Kết quả này không chứng minh RLS riêng sẽ chặn ghi nếu authenticated được cấp quyền ghi, và không chứng minh chính sách Staff/admin tại DB thật. Policy được quan sát là tenant-based `FOR ALL`; không thấy kiểm tra vai trò Staff hay grant Weekly Menu trong biểu thức policy đó, nhưng không suy ra đường khai thác hoặc kết quả ở môi trường khác.

Trước khi kết luận cho môi trường đích, cần đối chiếu owner, ACL, column privileges, RLS/policies, functions/triggers và identity catalog tại đúng target; thử Auth/PostgREST với fixture được phép và xác nhận mọi đường ghi trực tiếp. Không thay RLS/grants hoặc Production theo kết quả này. F09 transaction, guard amendment và Production readiness tiếp tục **NOT_PROVEN / DEFER**; kết quả FAIL trước đó của CI vẫn giữ nguyên.
