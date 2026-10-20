# Chạy bounded acceptance

Script chỉ chấp nhận E2E `bmnbqbcdbuklhopfbopv`; không chấp nhận production. Runtime phải có tree Product bằng baseline `ecfaf23ab06d043c5f2caec38ea67856705b6c26`. Commit chỉ thêm harness/evidence vẫn dùng được; sửa runtime sẽ bị entry gate chặn. Không tự nạp `.env.local`; Next auto-env file trong worktree cũng làm abort.

PowerShell, từ worktree đã có dependency đúng lockfile:

```powershell
Set-Location -LiteralPath 'C:\Users\DELL\.codex\worktrees\preschool-real-auth-acceptance-20261021\BELLA SPA ERP'
node --check scripts/verify-preschool-real-auth-acceptance.cjs
$env:E2E_ENV_FILE = 'D:\Antigravity\Projects\BELLA SPA ERP\.env.e2e'
try {
    node scripts/verify-preschool-real-auth-acceptance.cjs
    $taskAcceptanceExit = $LASTEXITCODE
} finally {
    Remove-Item Env:E2E_ENV_FILE
}
$taskAcceptanceExit
```

Không in nội dung env file, password, JWT hoặc cookie. Script tạo hai tenant và sáu Auth actor tổng hợp, chạy lần lượt rồi thu hồi/xóa authority. Hai tenant shell terminated có immutable audit history được giữ lại và đếm rõ. Một lần chạy có thể tạo thêm hai shell này; chỉ rerun khi có sửa đổi/finding cần xác minh.

Kết quả timestamp nằm trong folder này. `exit0 + PARTIAL_NOT_PROVEN` có nghĩa phần đã chạy không FAIL nhưng vẫn thiếu gate, **không** có nghĩa full Product PASS. Native exit1 và raw report phải giữ nguyên để đối chiếu. `cleanup.result` cần zero Auth/profile/active tenant và listener closed; shell/audit history không được xóa để làm con số đẹp.

Production scripts trong folder này chỉ dùng để đối chiếu source/deny/catalog đã định nghĩa; không có rollout hay DDL/DML nghiệp vụ. Các probe constant SQL chỉ `SELECT 1`; catalog script dùng transaction READ ONLY. Không chạy script remediation cũ hoặc rollback-only proposal để thay acceptance.
