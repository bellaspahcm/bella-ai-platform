# Bella Interior — Cloudflare R2 Setup Guide

## Bucket thông tin

| Item | Value |
|------|-------|
| **Account ID** | `3c8d589a1d10e0c3a2167a27abd354ab` |
| **Bucket name** | `bella-production` |
| **R2 Endpoint** | `https://3c8d589a1d10e0c3a2167a27abd354ab.r2.cloudflarestorage.com` |
| **Target CDN** | `https://cdn.bella-interior.com` |

## Cấu trúc thư mục R2

```
bella-production/
├── interior/
│   ├── projects/          # Thumbnail & hero ảnh dự án (Villa, Office Tower...)
│   ├── team/              # Avatar nhân sự, kiến trúc sư, PM
│   ├── design/            # Render, mockup, bản vẽ Design Studio
│   ├── materials/         # Catalog vật liệu, texture
│   ├── installation/      # Ảnh thi công thực tế tại công trình
│   ├── handover/          # Ảnh nghiệm thu, biên bản bàn giao
│   ├── finance/           # Hình minh hoạ tài chính, hợp đồng
│   ├── schedule/          # Lịch công việc & điều phối imagery
│   ├── customers/         # Avatar & ảnh khách hàng
│   ├── reports/           # Ảnh bìa báo cáo
│   └── warranty/          # Bảo hành, hậu mãi
└── shared/                # Logo, icon, UI assets dùng chung
```

## Bước 1 — Tạo R2 API Token

1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Chọn **R2 Object Storage** → **Manage R2 API Tokens**
3. Click **Create API Token**
4. Đặt tên: `bella-interior-upload`
5. Permissions: **Object Read & Write**
6. Scope: **Specific bucket** → `bella-production`
7. Copy **Access Key ID** và **Secret Access Key**

## Bước 2 — Thêm credentials vào `.env.local`

```bash
R2_ACCOUNT_ID=3c8d589a1d10e0c3a2167a27abd354ab
R2_ACCESS_KEY_ID=<paste-access-key-id>
R2_SECRET_ACCESS_KEY=<paste-secret-access-key>
R2_BUCKET_NAME=bella-production
R2_PUBLIC_BASE_URL=https://cdn.bella-interior.com
```

## Bước 3 — Upload toàn bộ ảnh lên R2

```bash
# Install dependency (một lần)
npm install @aws-sdk/client-s3 --save-dev

# Upload 33 ảnh Bella Interior lên R2
node scripts/r2-upload/upload-to-r2.mjs
```

Script sẽ:
- Download từng ảnh từ Unsplash (quality 90)
- Upload vào đúng thư mục trong R2
- Tạo file `scripts/r2-upload/r2-url-mapping.json` chứa mapping URL

## Bước 4 — Cập nhật toàn bộ codebase

```bash
# Xem trước (không thay đổi file)
node scripts/r2-upload/replace-urls.mjs --dry-run

# Áp dụng thay thế URL
node scripts/r2-upload/replace-urls.mjs
```

## Bước 5 — Verify & commit

```bash
npx tsc --noEmit
npx jest --testPathPatterns="bella-interior" --passWithNoTests
git add -A
git commit -m "feat: migrate all Bella Interior images from Unsplash to Cloudflare R2"
```

## Bước 6 — Cấu hình Custom Domain (tuỳ chọn)

1. Cloudflare Dashboard → R2 → `bella-production` → **Settings**
2. **Custom Domains** → Add `cdn.bella-interior.com`
3. Cloudflare sẽ tự thêm DNS record

## Sử dụng trong code mới

```typescript
// ✅ Đúng — dùng BELLA_INTERIOR_ASSETS từ src/lib/r2.ts
import { BELLA_INTERIOR_ASSETS } from '@/lib/r2';

const thumbnailUrl = BELLA_INTERIOR_ASSETS.PROJECT_VILLA_SUNRISE;

// ❌ Sai — không hardcode Unsplash URL trong service/component mới
const url = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300';
```

## Danh sách 33 ảnh cần upload

| R2 Key | Mô tả | Dùng trong |
|--------|-------|-----------|
| `interior/projects/villa-sunrise-renovation.jpg` | Villa Sunrise hero | Projects, Schedule, Reports |
| `interior/projects/office-tower-lobby.jpg` | Office Tower Lobby | Projects, Reports |
| `interior/projects/skyline-residence.jpg` | Skyline Residence | Projects, Reports |
| `interior/projects/the-garden-villa.jpg` | The Garden Villa | Projects, Schedule |
| `interior/projects/commercial-award-project.jpg` | Commercial Award Project | Portfolio |
| `interior/projects/office-tower-wide.jpg` | Office Tower wide | Design, Schedule |
| `interior/projects/skyline-residence-alt.jpg` | Skyline alt thumb | Schedule |
| `interior/design/project-render-warm.jpg` | Render warm tones | Design Studio |
| `interior/design/kitchen-design-render.jpg` | Kitchen design render | Design, Installation |
| `interior/design/bedroom-render-modern.jpg` | Bedroom render | Design Studio |
| `interior/design/luxury-living-room.jpg` | Luxury living room | Design Studio |
| `interior/design/bathroom-design.jpg` | Bathroom design | Design Studio |
| `interior/design/material-texture-board.jpg` | Material board | Design Studio |
| `interior/design/accent-wall-detail.jpg` | Accent wall | Design Studio |
| `interior/materials/wood-panel.jpg` | Wood panel | Materials |
| `interior/materials/stone-tile.jpg` | Stone tile | Materials |
| `interior/materials/fabric-upholstery.jpg` | Fabric swatch | Materials |
| `interior/installation/site-progress-main.jpg` | Site progress | Installation, Contract |
| `interior/installation/furniture-assembly.jpg` | Furniture assembly | Installation |
| `interior/installation/ceiling-work.jpg` | Ceiling work | Installation |
| `interior/installation/flooring-installation.jpg` | Flooring | Installation |
| `interior/handover/qc-inspector-avatar.jpg` | QC Inspector avatar | Handover, Team |
| `interior/handover/handover-signoff.jpg` | Handover sign-off | Handover |
| `interior/finance/financial-report-cover.jpg` | Finance report cover | Finance, Reports |
| `interior/team/finance-director-male.jpg` | Finance Director | Finance, Team |
| `interior/team/staff-female-1.jpg` | Staff female 1 | Customers, Schedule |
| `interior/team/staff-male-architect-1.jpg` | Architect male 1 | Customers, Schedule |
| `interior/team/staff-male-2.jpg` | Staff male 2 | Customers, Schedule |
| `interior/team/staff-female-site.jpg` | Site staff female | Schedule |
| `interior/customers/client-female-1.jpg` | Client female 1 | Customers, Warranty |
| `interior/customers/client-female-2.jpg` | Client female 2 | Customers, Handover |
| `interior/customers/client-male-1.jpg` | Client male 1 | Customers |
| `interior/customers/client-testimonial-female.jpg` | Testimonial avatar | Portfolio |

