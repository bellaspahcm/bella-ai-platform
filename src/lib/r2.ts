/**
 * Bella Platform — Cloudflare R2 CDN URL Helper
 *
 * Resolves R2 asset URLs across the Bella Interior codebase.
 * Always prefer r2Url() over raw hard-coded Unsplash URLs in new code.
 *
 * @module src/lib/r2
 */

/**
 * Public base URL for the Cloudflare R2 CDN bucket (bella-production).
 * Resolved from NEXT_PUBLIC_R2_BASE_URL env var, with fallback to the
 * direct R2 endpoint for development.
 */
const R2_BASE =
  process.env.NEXT_PUBLIC_R2_BASE_URL ??
  `https://${process.env.R2_ACCOUNT_ID ?? '3c8d589a1d10e0c3a2167a27abd354ab'}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME ?? 'bella-production'}`;

/**
 * Returns the full CDN URL for a given R2 object key.
 *
 * @example
 * r2Url('interior/projects/villa-sunrise-renovation.jpg')
 * // → 'https://cdn.bella-interior.com/interior/projects/villa-sunrise-renovation.jpg'
 */
export function r2Url(key: string): string {
  return `${R2_BASE}/${key.replace(/^\//, '')}`;
}

/**
 * Pre-resolved Bella Interior R2 asset map.
 * Keys match the r2_key values in r2-image-manifest.json.
 * Use these constants in service and component files instead of raw URLs.
 */
export const BELLA_INTERIOR_ASSETS = {
  /* ── Projects ─────────────────────────────────────────────── */
  PROJECT_VILLA_SUNRISE: r2Url('interior/projects/villa-sunrise-renovation.jpg'),
  PROJECT_OFFICE_TOWER: r2Url('interior/projects/office-tower-lobby.jpg'),
  PROJECT_SKYLINE_RESIDENCE: r2Url('interior/projects/skyline-residence.jpg'),
  PROJECT_GARDEN_VILLA: r2Url('interior/projects/the-garden-villa.jpg'),
  PROJECT_SKYLINE_RESIDENCE_ALT: r2Url('interior/projects/skyline-residence-alt.jpg'),
  PROJECT_OFFICE_TOWER_WIDE: r2Url('interior/projects/office-tower-wide.jpg'),
  PROJECT_COMMERCIAL_AWARD: r2Url('interior/projects/commercial-award-project.jpg'),

  /* ── Design Studio ────────────────────────────────────────── */
  DESIGN_RENDER_WARM: r2Url('interior/design/project-render-warm.jpg'),
  DESIGN_KITCHEN_RENDER: r2Url('interior/design/kitchen-design-render.jpg'),
  DESIGN_BEDROOM_MODERN: r2Url('interior/design/bedroom-render-modern.jpg'),
  DESIGN_LUXURY_LIVING: r2Url('interior/design/luxury-living-room.jpg'),
  DESIGN_BATHROOM: r2Url('interior/design/bathroom-design.jpg'),
  DESIGN_MATERIAL_BOARD: r2Url('interior/design/material-texture-board.jpg'),
  DESIGN_ACCENT_WALL: r2Url('interior/design/accent-wall-detail.jpg'),

  /* ── Materials ────────────────────────────────────────────── */
  MATERIAL_WOOD_PANEL: r2Url('interior/materials/wood-panel.jpg'),
  MATERIAL_STONE_TILE: r2Url('interior/materials/stone-tile.jpg'),
  MATERIAL_FABRIC: r2Url('interior/materials/fabric-upholstery.jpg'),

  /* ── Installation ─────────────────────────────────────────── */
  INSTALLATION_SITE_PROGRESS: r2Url('interior/installation/site-progress-main.jpg'),
  INSTALLATION_FURNITURE: r2Url('interior/installation/furniture-assembly.jpg'),
  INSTALLATION_CEILING: r2Url('interior/installation/ceiling-work.jpg'),
  INSTALLATION_FLOORING: r2Url('interior/installation/flooring-installation.jpg'),

  /* ── QC & Handover ────────────────────────────────────────── */
  HANDOVER_QC_INSPECTOR: r2Url('interior/handover/qc-inspector-avatar.jpg'),
  HANDOVER_SIGNOFF: r2Url('interior/handover/handover-signoff.jpg'),

  /* ── Finance ──────────────────────────────────────────────── */
  FINANCE_REPORT_COVER: r2Url('interior/finance/financial-report-cover.jpg'),

  /* ── Team / Staff Avatars ─────────────────────────────────── */
  TEAM_FINANCE_DIRECTOR: r2Url('interior/team/finance-director-male.jpg'),
  TEAM_STAFF_FEMALE_1: r2Url('interior/team/staff-female-1.jpg'),
  TEAM_STAFF_MALE_ARCHITECT_1: r2Url('interior/team/staff-male-architect-1.jpg'),
  TEAM_STAFF_MALE_2: r2Url('interior/team/staff-male-2.jpg'),
  TEAM_STAFF_FEMALE_SITE: r2Url('interior/team/staff-female-site.jpg'),

  /* ── Customers ────────────────────────────────────────────── */
  CUSTOMER_FEMALE_1: r2Url('interior/customers/client-female-1.jpg'),
  CUSTOMER_FEMALE_2: r2Url('interior/customers/client-female-2.jpg'),
  CUSTOMER_MALE_1: r2Url('interior/customers/client-male-1.jpg'),
  CUSTOMER_TESTIMONIAL_FEMALE: r2Url('interior/customers/client-testimonial-female.jpg'),
} as const;

export type BellaInteriorAssetKey = keyof typeof BELLA_INTERIOR_ASSETS;
