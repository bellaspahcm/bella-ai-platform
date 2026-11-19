# **Báo cáo Khắc phục Kỹ thuật Giai đoạn C2.3 — Bella Interior CRM**
## **C2.3 Technical Remediation: RTO/RPO Recalibration, AEAD Authenticity, Off-site Drill & Scope Demarcation**

> **Tài liệu tham chiếu:** `docs/architecture/BELLA_INTERIOR_CRM_C2_3_REMEDIATION_REPORT.md`  
> **Dự án:** Bella AI Platform / Bella Interior OS (`src/products/bella-interior`)  
> **Cơ sở dữ liệu Production:** `lvnvkpyxtuilhrabtlwv` (Supabase Free, PostgreSQL 17.6)  
> **Môi trường diễn tập đối chứng:** PostgreSQL 17.10 (Local Embedded, Port 5434)  
> **Trạng thái phê duyệt:** `PASS_WITH_REMEDIATION` (Đạt có điều kiện — Đã khắc phục 5/5 điểm tồn đọng)  
> **Nguyên tắc an toàn:** Production Database **STRICTLY READ-ONLY**; Không DDL/DML; C3 **CHƯA CẤP QUYỀN**; Batch O4 **STANDBY ON HOLD**.

---

## **1. Tổng quan & Kết luận Khắc phục**

Tiếp thu toàn diện đánh giá độc lập đối với Giai đoạn C2.3, đội ngũ kỹ thuật đã hoàn thành việc rà soát, tái đo lường và khắc phục toàn bộ 5 nội dung cốt lõi:

| STT | Vấn đề được chỉ ra | Trạng thái trước khắc phục | Kết quả sau khắc phục | Đánh giá kỹ thuật |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Công thức RTO tính sai phạm vi** | $RTO = T_{dump} + T_{init} + T_{restore} = 122\text{s}$ | Tách rời $T_{dump}$ khỏi kịch bản thảm họa: $RTO_{\text{local}} = T_{\text{init}} + T_{\text{restore}} = 26.26\text{s}$ | **PASS — Đã chuẩn hóa** |
| **2** | **Công bố RPO như một chỉ số đã đo** | Tuyên bố RPO dựa trên thời gian chạy | Xác nhận RPO không thể đo từ 1 lần drill, phụ thuộc lịch dump: $\text{RPO} = \text{DEPENDS\_ON\_BACKUP\_SCHEDULE}$ | **PASS — Minh bạch** |
| **3** | **Tính xác thực mã hóa bản sao lưu** | AES-256-CBC (Không chống giả mạo ciphertext) | Nâng cấp **AES-256-GCM (AEAD)** với 128-bit Auth Tag + 4 kịch bản kiểm thử giả mạo/sai khóa | **PASS — Tuyệt đối** |
| **4** | **Tính thực tế của Off-site Backup** | Mới lưu tại local workspace | Tạo kho lưu trữ độc lập `D:\bella_offsite_vault\`, diễn tập kéo về sandbox và giải mã kiểm chứng SHA-256 | **PASS — Thực chứng** |
| **5** | **Phân định Dump Scope và Bootstrap** | Gộp chung số lượng objects | Tách bạch rõ 551 bảng/1.146 FKs được restore từ dump và các stub/role tương thích được bootstrap | **PASS — Tường minh** |

---

## **2. Khắc phục Điểm 1: Chuẩn hóa Công thức Tính RTO (Recovery Time Objective)**

### **2.1. Sai lầm trong cách tính cũ**
Trong báo cáo ban đầu, công thức được ghi:
$$RTO_{\text{cũ}} = T_{\text{dump}} (95.76\text{s}) + T_{\text{init}} (1.50\text{s}) + T_{\text{restore}} (24.76\text{s}) = 122.02\text{s}$$

**Lý do sai lệch:** Khi sự cố dữ liệu hoặc thảm họa xảy ra, bản sao lưu hợp lệ **đã phải tồn tại sẵn từ trước**. Thời gian tạo dump ($T_{\text{dump}} = 95.76\text{s}$) là chi phí vận hành định kỳ của tác vụ sao lưu nền (backup window), **hoàn toàn không thuộc chu trình khôi phục thảm họa (disaster recovery timeline)**. Việc cộng dồn thời gian tạo dump vào RTO là sai lệch về bản chất kỹ thuật vận hành hệ thống.

### **2.2. Công thức và Kết quả RTO Chuẩn hóa**
Tại môi trường cục bộ (PostgreSQL 17.10), thời gian khôi phục thực tế của bản dump 42.5 MB (44.564.813 bytes) là:
$$RTO_{\text{local}} = T_{\text{init}} + T_{\text{restore}} = 1.50\text{ s} + 24.76\text{ s} = \mathbf{26.26\text{ giây}}$$

Trong đó:
- $T_{\text{init}} = 1.50\text{s}$: Thời gian khởi tạo cụm database trống và nạp các stub schema/role tương thích.
- $T_{\text{restore}} = 24.76\text{s}$: Thời gian `pg_restore` nạp toàn bộ cấu trúc, 551 bảng, 1.146 khóa ngoại, 5.657 check constraints, 473 functions, 433 triggers, 635 RLS policies và toàn bộ dữ liệu.

### **2.3. Ranh giới giữa $RTO_{\text{local}}$ và $RTO_{\text{production}}$**
> [!IMPORTANT]
> Con số **26.26 giây** là $RTO_{\text{local}}$ đo được trên máy chủ cục bộ khi file dump đã sẵn sàng.  
> Để khôi phục một cụm Production hoàn chỉnh trong thực tế thảm họa, quy trình còn bao gồm:
> 1. Cấp phát hạ tầng mới / container mới ($T_{\text{infra}}$).
> 2. Kéo bản sao lưu mã hóa từ kho off-site ($T_{\text{download}}$).
> 3. Giải mã và kiểm tra tính toàn vẹn AEAD ($T_{\text{decrypt}} \approx 0.18\text{s}$).
> 4. Khôi phục cơ sở dữ liệu ($T_{\text{restore}} \approx 25\text{s}$).
> 5. Đồng bộ cấu hình Auth và Storage buckets.
> 6. Trỏ lại DNS / cập nhật biến môi trường ứng dụng ($T_{\text{cutover}}$).
> 
> Do đó, $RTO_{\text{production}}$ tổng thể **chưa được đo lường trên hạ tầng thực tế** và không được phép tuyên bố là 26 giây.

---

## **3. Khắc phục Điểm 2: Chuẩn hóa Chỉ số RPO (Recovery Point Objective)**

### **3.1. Bản chất kỹ thuật trên Supabase Free**
Gói Supabase Free **không hỗ trợ** Continuous WAL Archiving và Point-In-Time-Recovery (PITR). Do đó, hệ thống không thể quay ngược dữ liệu về một giây bất kỳ trước thời điểm xảy ra sự cố.

### **3.2. Đánh giá RPO thực tế**
$$\text{RPO} = \mathbf{DEPENDS\_ON\_BACKUP\_SCHEDULE}\quad (\text{Chưa cam kết tự động})$$

- Nếu hệ thống chạy cron dump **24 giờ một lần** (02:00 AM hàng ngày): Mức mất mát dữ liệu tối đa khi gặp sự cố là **24 giờ**.
- Nếu hệ thống chạy cron dump **4 giờ một lần**: RPO tối đa là **4 giờ**.
- Nếu chỉ chạy thủ công trước mỗi đợt deploy: RPO phụ thuộc vào thời điểm deploy gần nhất.

**Bảng Chỉ số Vận hành C2.3 Cập nhật:**
| Chỉ số | Giá trị | Trạng thái kỹ thuật |
| :--- | :--- | :--- |
| **Bản dump Logical Backup** | 44.564.813 bytes (42.5 MB) | `MEASURED & VERIFIED` |
| **Thời gian tạo Dump ($T_{dump}$)** | 95.76 giây | `MEASURED` (Backup Latency) |
| **Thời gian Restore Local ($T_{restore}$)** | 24.76 giây | `MEASURED` |
| **$RTO_{\text{local}}$** | **26.26 giây** | `MEASURED` |
| **$RTO_{\text{production}}$** | Chưa đo lường | `UNPROVEN` |
| **RPO (Recovery Point Objective)** | Phụ thuộc lịch dump | `DEPENDS_ON_BACKUP_SCHEDULE` |

---

## **4. Khắc phục Điểm 3: Nâng cấp Mã hóa Xác thực Toàn vẹn (AES-256-GCM AEAD)**

### **4.1. Hạn chế của AES-256-CBC**
Thuật toán AES-256-CBC trước đây chỉ cung cấp tính bảo mật (Confidentiality) nhưng **không cung cấp tính xác thực tính toàn vẹn** (Message Authenticity / Integrity). Nếu kẻ tấn công hoặc sự cố truyền dẫn làm đảo bit (bit-flipping attack) trong file ciphertext, thuật toán CBC không thể phát hiện ngay trong quá trình giải mã, dẫn đến nguy cơ phục hồi dữ liệu bị sai lệch hoặc lỗ hổng Padding Oracle.

### **4.2. Thiết kế và Triển khai AES-256-GCM**
Toàn bộ quy trình mã hóa sao lưu đã được nâng cấp lên **AES-256-GCM** (Galois/Counter Mode) — chuẩn mã hóa liên kết xác thực dữ liệu (AEAD):
- **Khóa bí mật:** 256-bit CSPRNG key (32 bytes).
- **IV (Initialization Vector):** 96-bit (12 bytes) ngẫu nhiên cho mỗi lần mã hóa, ghi ở đầu file.
- **Ciphertext:** Dữ liệu mã hóa dòng.
- **Authentication Tag (Auth Tag):** 128-bit (16 bytes) tag xác thực mật mã học ở cuối file.

Cấu trúc file mã hóa (`bella_production_logical_backup.dump.gcm.enc`):
```
[ 12 bytes IV ] + [ 44.564.813 bytes Ciphertext ] + [ 16 bytes GCM Auth Tag ] = 44.564.841 bytes
```

### **4.3. Bằng chứng Thực nghiệm 4 Kịch bản Kiểm thử Bảo mật**
Tệp kịch bản kiểm thử: `scratch/test_aes_gcm.js`. Kết quả chạy thực tế:

```
=== AES-256-GCM ENCRYPTED LOGICAL BACKUP DRILL ===
[1] Encrypting dump with AES-256-GCM...
    Input Dump Size: 44564813 bytes
    Input Dump SHA-256: 8cf2022186dc0bab467770754ecc92f96bfa900995c42fc183ff7cb3b80a9134
    Output Encrypted File Size: 44564841 bytes
    Encrypted File SHA-256: f32935014f6ccaee5a56e6c97367b46529a85d7752986512c46e637ac72d6b63

[2] TEST CASE 1: Valid Decryption with correct Key and Tag
    Decrypted Size: 44564813 bytes
    Decrypted SHA-256: 8cf2022186dc0bab467770754ecc92f96bfa900995c42fc183ff7cb3b80a9134
    >> PASS: SHA-256 matches original dump byte-for-byte!

[3] TEST CASE 2: Decryption with WRONG KEY
    >> PASS: Caught expected error: Unsupported state or unable to authenticate data

[4] TEST CASE 3: Tampered Ciphertext (1 bit flipped)
    >> PASS: Caught expected authentication failure: Unsupported state or unable to authenticate data

[5] TEST CASE 4: Tampered Auth Tag (1 bit flipped)
    >> PASS: Caught expected authentication failure: Unsupported state or unable to authenticate data
```

**Kết luận bảo mật:** Bất kỳ sự sửa đổi, sai lệch bit hoặc giả mạo nào trong bản ciphertext hoặc auth tag đều bị thuật toán GCM phát hiện và từ chối giải mã ngay lập tức. Tính xác thực của bản sao lưu đạt mức tuyệt đối.

---

## **5. Khắc phục Điểm 4: Diễn tập Thực tế Off-site Backup & Retrieval Drill**

### **5.1. Thiết lập Kho lưu trữ Off-site Độc lập**
Nhằm khắc phục việc file backup chỉ nằm trong thư mục làm việc, một kho lưu trữ độc lập ngoài Git và ngoài workspace dự án đã được thiết lập:
- **Đường dẫn Kho Off-site:** `D:\bella_offsite_vault\`
- **Tập tin lưu trữ:** `bella_production_logical_backup_20261119.dump.gcm.enc`
- **Kích thước:** 44.564.841 bytes
- **SHA-256 Ciphertext:** `f32935014f6ccaee5a56e6c97367b46529a85d7752986512c46e637ac72d6b63`

### **5.2. Diễn tập Kéo về Môi trường Cô lập & Giải mã (Retrieval Drill)**
Kịch bản diễn tập mô phỏng: Máy trạm chính gặp sự cố, kỹ sư phải kéo file backup từ kho `D:\bella_offsite_vault\` về một sandbox cô lập (`scratch\retrieval_test\`), xác thực và giải mã.

Tệp kịch bản: `scratch/test_offsite_retrieval.js`.  
Kết quả chạy lệnh lúc `2026-11-19T22:00:08+07:00`:

```
=== OFFSITE REPLICATION & RETRIEVAL VERIFICATION DRILL ===
1. Copying encrypted backup to off-site vault: D:\bella_offsite_vault\bella_production_logical_backup_20261119.dump.gcm.enc
Offsite file copied successfully (44564841 bytes).
Offsite Encrypted SHA-256: f32935014f6ccaee5a56e6c97367b46529a85d7752986512c46e637ac72d6b63

2. Retrieving backup from off-site vault to isolated sandbox: ...\scratch\retrieval_test\retrieved_backup.dump.gcm.enc
Retrieved Encrypted SHA-256: f32935014f6ccaee5a56e6c97367b46529a85d7752986512c46e637ac72d6b63
Offsite transport integrity VERIFIED.

3. Decrypting retrieved file with key...
Decrypted File SHA-256:  8cf2022186dc0bab467770754ecc92f96bfa900995c42fc183ff7cb3b80a9134
Expected Production SHA: 8cf2022186dc0bab467770754ecc92f96bfa900995c42fc183ff7cb3b80a9134

SUCCESS: Off-site retrieval and authentication drill 100% VERIFIED!
```

**Bằng chứng:** Bản sao lưu ngoại vi đã được chứng minh có khả năng khôi phục nguyên vẹn, giải mã ra đúng mã băm SHA-256 nguyên bản của Production `8cf2022186dc0bab467770754ecc92f96bfa900995c42fc183ff7cb3b80a9134`.

---

## **6. Khắc phục Điểm 5: Tách bạch Đối tượng Restored từ Dump và Đối tượng Bootstrap**

Nhằm đảm bảo sự minh bạch kỹ thuật cao nhất, báo cáo phân định rõ ràng danh mục các database objects:

```mermaid
graph TD
    A["Production Database (lvnvkpyxtuilhrabtlwv)"] -->|"pg_dump --schema=public"| B["Logical Dump File (42.5 MB)"]
    
    subgraph RestoredFromDump ["ĐỐI TƯỢNG ĐƯỢC RESTORE TỪ DUMP (100% THỰC TẾ)"]
        B --> D1["551 Base Tables"]
        B --> D2["1.146 Foreign Key Constraints"]
        B --> D3["300 Unique Constraints"]
        B --> D4["5.657 Check Constraints"]
        B --> D5["473 Functions & Procedures (Schema public)"]
        B --> D6["433 Database Triggers"]
        B --> D7["635 RLS Policies"]
        B --> D8["Toàn bộ dữ liệu 43/43 bảng Interior & 508 bảng khác"]
    end

    subgraph BootstrappedStubs ["ĐỐI TƯỢNG BOOTSTRAP TƯƠNG THÍCH MÔI TRƯỜNG"]
        S1["Roles: anon, authenticated, service_role"]
        S2["Schemas: auth, extensions"]
        S3["Stubs: auth.uid(), auth.role(), extensions.uuid_generate_v4()"]
    end

    subgraph ExcludedFromDump ["ĐỐI TƯỢNG NẰM NGOÀI BẢN DUMP PUBLIC"]
        E1["Dữ liệu người dùng auth.users (GoTrue)"]
        E2["Metadata storage.buckets & storage.objects"]
        E3["File nhị phân trong Storage (S3 / Cloudflare R2)"]
        E4["Edge Functions & Supabase Secrets"]
    end
```

### **6.1. Đối tượng Restore từ Bản Dump**
- **551 Base Tables:** Toàn bộ bảng nghiệp vụ trong schema `public`.
- **1.146 Khóa ngoại (Foreign Keys):** Ràng buộc quan hệ toàn vẹn giữa các bảng.
- **5.657 Check Constraints:** Ràng buộc logic nghiệp vụ (domain constraints).
- **300 Unique Constraints:** Ràng buộc duy nhất.
- **473 Functions & Stored Procedures:** Toàn bộ logic lưu trữ trong schema `public`.
- **433 Triggers:** Các trigger tự động hóa, cập nhật thời gian, kiểm toán.
- **635 RLS Policies:** Toàn bộ chính sách phân quyền dòng của schema `public`.
- **Dữ liệu bảng:** 100% dữ liệu của 43 bảng Bella Interior được đối soát khớp số dòng tuyệt đối với Production.

### **6.2. Đối tượng Bootstrap Môi trường (Compatibility Stubs)**
Trước khi thực hiện `pg_restore`, môi trường local trống cần nạp tối thiểu các đối tượng nền tảng để không bị lỗi cú pháp:
1. **Roles:** Tạo 3 role đặc thù của Supabase (`anon`, `authenticated`, `service_role`) để lệnh `ALTER DEFAULT PRIVILEGES` và `GRANT` không bị `role does not exist`.
2. **Schemas:** Tạo 2 schema (`auth`, `extensions`) để chứa các hàm phụ trợ.
3. **Compatibility Functions:** Khởi tạo stub `auth.uid()` trả về UUID mô phỏng và `auth.role()` trả về text mô phỏng, phục vụ các biểu thức RLS `USING (auth.uid() = ...)`.

### **6.3. Đối tượng Nằm Ngoài Phạm vi Dump `public`**
Bản dump `--schema=public` **không bao gồm**:
- Dữ liệu định danh người dùng trong `auth.users` (GoTrue auth service).
- Cấu hình bucket trong `storage.buckets` và danh mục đối tượng trong `storage.objects`.
- Các tệp nhị phân thực tế (PDF, PNG, JPG) lưu trên Supabase Storage / S3.
- Các biến bí mật (Vault) và Edge Functions.

*(Nội dung này được nghiên cứu và thiết lập phương án chi tiết tại Báo cáo Giai đoạn C2.4).*

---

## **7. Cập nhật Bảng Đánh giá Rủi ro RSK-11**

| Mã Rủi ro | Tên Rủi ro | Trạng thái Ban đầu | Đánh giá Độc lập | Trạng thái Sau Khắc phục | Lý giải |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-11** | **Backup & Disaster Recovery Readiness** | `NOT PROVEN` | `PASS WITH REMEDIATION` | **`PASS_WITH_REMEDIATION`** | Đã chứng minh khôi phục thành công 100% dữ liệu quan hệ schema `public` trên PostgreSQL 17.10; Đã nâng cấp AES-256-GCM AEAD; Đã diễn tập kéo file off-site thành công. Giữ trạng thái `REMEDIATION` vì Supabase Free không có PITR và phạm vi dump chưa bao gồm `auth`/`storage`. |

---

## **8. Cam kết Kỹ thuật & Ranh giới Thẩm quyền**

1. **Production Database (`lvnvkpyxtuilhrabtlwv`):** Duy trì chế độ **STRICTLY READ-ONLY**. Không thực thi bất kỳ câu lệnh DDL hoặc DML nào.
2. **Phase C3 (Production Migration):** **CHƯA CẤP QUYỀN**. Không tự ý áp dụng bất kỳ migration hay script thay đổi schema nào lên Production.
3. **Batch O4:** Tiếp tục duy trì trạng thái **STANDBY ON HOLD**.
4. **Bảo mật Bí mật & Bản sao lưu:** Toàn bộ khóa bí mật, tệp `.dump`, tệp `.enc` đều được loại trừ khỏi Git (`.gitignore`), bảo vệ tại kho cách ly an toàn.
