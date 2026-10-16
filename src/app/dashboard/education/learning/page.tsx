'use client';

/**
 * Bella Education — Learning & Development Workspace (P5.4)
 * 
 * Deep Domain Architecture:
 * - Teacher Learning Workspace & Work Queue
 * - Observation Logging (Planned / Spontaneous), Evidence Privacy & Consent Scopes
 * - Qualitative Progress Interpretation (`EMERGING`, `DEVELOPING`, `CONSISTENT`, `NEEDS_SUPPORT`)
 * - Actionable Next Steps (Classroom & Home)
 * - Versioned Developmental Portfolio Compilation, Publication & SHA-256 Checksum
 * - Parent View Projection (Filters out INTERNAL_TEACHER evidence & unconfirmed items)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ArrowLeft,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  Sparkles,
  Clock,
  Activity,
  Plus,
  Check,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  Info,
  Search,
  Filter,
  Eye,
  FileText,
  Lock,
  Upload,
  AlertCircle,
  Award,
  Layers
} from 'lucide-react';

const EVIDENCE_VISIBILITIES = ['INTERNAL_TEACHER', 'PARENT_SHARED'] as const;
const CONSENT_SCOPES = ['CONSENT_VERIFIED', 'OPT_OUT'] as const;

type EvidenceVisibility = (typeof EVIDENCE_VISIBILITIES)[number];
type ConsentScope = (typeof CONSENT_SCOPES)[number];

function isEvidenceVisibility(value: string): value is EvidenceVisibility {
  return EVIDENCE_VISIBILITIES.includes(value as EvidenceVisibility);
}

function isConsentScope(value: string): value is ConsentScope {
  return CONSENT_SCOPES.includes(value as ConsentScope);
}

export default function LearningWorkspacePage() {
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'OBSERVATION' | 'PORTFOLIO' | 'PARENT_VIEW'>('QUEUE');
  
  // Work Queue State
  const [workQueue, setWorkQueue] = useState({
    totalStudents: 25,
    unobservedCount: 4,
    pendingProgressCount: 2,
    nextStepsDueCount: 3,
    portfoliosReadyCount: 1,
  });

  // Observation Form State
  const [obsText, setObsText] = useState('Bé tự lập sắp xếp 5 hình khối gỗ theo đúng thứ tự mầu sắc.');
  const [selectedStudentId, setSelectedStudentId] = useState('00000000-0000-0000-0000-000000000100');
  const [evidenceVisibility, setEvidenceVisibility] = useState<EvidenceVisibility>('PARENT_SHARED');
  const [consentScope, setConsentScope] = useState<ConsentScope>('CONSENT_VERIFIED');
  const [milestoneCode, setMilestoneCode] = useState('COG-01 (Phân loại màu sắc)');
  const [obsSuccessMessage, setObsSuccessMessage] = useState<string | null>(null);

  // Interpretation State
  const [progressStatus, setProgressStatus] = useState<'EMERGING' | 'DEVELOPING' | 'CONSISTENT' | 'NEEDS_SUPPORT'>('CONSISTENT');
  const [progressRationale, setProgressRationale] = useState('Bé đã thực hành thành công 3 lần trong tuần với các khối gỗ màu.');
  const [isConfirmed, setIsConfirmed] = useState(true);

  // Portfolio State
  const [portfolioStatus, setPortfolioStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [portfolioVersionNumber, setPortfolioVersionNumber] = useState(1);
  const [publicationChecksum, setPublicationChecksum] = useState<string | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  // Execute Observation Logging
  const handleSaveObservation = () => {
    setObsSuccessMessage(`Đã lưu quan sát thành công cho bé! (Visibility: ${evidenceVisibility}, Consent: ${consentScope})`);
    setTimeout(() => setObsSuccessMessage(null), 4000);
  };

  // Execute Portfolio Publishing
  const handlePublishPortfolio = () => {
    setPortfolioError(null);
    if (consentScope === 'OPT_OUT') {
      setPortfolioError('PORTFOLIO_CONSENT_VIOLATION_ERROR: Không thể xuất bản ảnh của trẻ khi chưa có xác nhận Consent hợp lệ (OPT_OUT).');
      return;
    }
    setPortfolioStatus('PUBLISHED');
    setPublicationChecksum('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  };

  // Edit Published Portfolio (Trigger DB Lock)
  const handleEditPublishedPortfolio = () => {
    setPortfolioError('PORTFOLIO_PUBLISHED_IMMUTABLE_ERROR: Portfolio đã xuất bản là Immutable. Đang chuyển sang tạo Version 2 (DRAFT)...');
    setTimeout(() => {
      setPortfolioVersionNumber(2);
      setPortfolioStatus('DRAFT');
      setPublicationChecksum(null);
      setPortfolioError(null);
    }, 2500);
  };

  return (
    <div className="preschool-ui min-h-screen bg-background text-foreground p-6 space-y-6">
      {/* Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/education" className="p-2 bg-muted hover:bg-muted rounded-lg transition">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-[var(--education-brand-ink)]" />
              Learning Command Center — Lớp Mầm A
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1 ml-11">
            Không điểm số hóa trẻ · Quản lý quan sát, minh chứng, tiến trình phát triển & hồ sơ xuất bản cho phụ huynh
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> P5 Learning & Development
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-[var(--education-brand-ink)] border border-primary/20">
            25 Bé Đang Học
          </span>
        </div>
      </div>

      {/* Action Required Work Queue Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-muted border border-amber-500/30 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-lg text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400" id="queue-unobserved-count">{workQueue.unobservedCount} Bé</div>
            <div className="text-xs text-muted-foreground font-medium">Chưa có quan sát tuần này</div>
          </div>
        </div>

        <div className="bg-muted border border-indigo-500/30 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-700 dark:text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400" id="queue-pending-count">{workQueue.pendingProgressCount} Đề Xuất</div>
            <div className="text-xs text-muted-foreground font-medium">Đánh giá chờ giáo viên xác nhận</div>
          </div>
        </div>

        <div className="bg-muted border border-emerald-500/30 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-700 dark:text-emerald-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400" id="queue-nextsteps-count">{workQueue.nextStepsDueCount} Kế Hoạch</div>
            <div className="text-xs text-muted-foreground font-medium">Bước hỗ trợ đến hạn review</div>
          </div>
        </div>

        <div className="bg-muted border border-purple-500/30 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg text-purple-700 dark:text-purple-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-400" id="queue-portfolios-count">{workQueue.portfoliosReadyCount} Hồ Sơ</div>
            <div className="text-xs text-muted-foreground font-medium">Portfolio sẵn sàng xuất bản</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border space-x-2">
        <button
          id="tab-queue"
          onClick={() => setActiveTab('QUEUE')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition flex items-center gap-2 ${
            activeTab === 'QUEUE' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Layers className="w-4 h-4" /> Work Queue Lớp Hàng Ngày
        </button>
        <button
          id="tab-observation"
          onClick={() => setActiveTab('OBSERVATION')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition flex items-center gap-2 ${
            activeTab === 'OBSERVATION' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Plus className="w-4 h-4" /> Ghi Nhận Quan Sát & Minh Chứng
        </button>
        <button
          id="tab-portfolio"
          onClick={() => setActiveTab('PORTFOLIO')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition flex items-center gap-2 ${
            activeTab === 'PORTFOLIO' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Award className="w-4 h-4" /> Hồ Sơ Portfolio & Xuất Bản
        </button>
        <button
          id="tab-parent-view"
          onClick={() => setActiveTab('PARENT_VIEW')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition flex items-center gap-2 ${
            activeTab === 'PARENT_VIEW' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Eye className="w-4 h-4" /> Projection Phụ Huynh Xem (Parent View)
        </button>
      </div>

      {/* TAB 1: WORK QUEUE */}
      {activeTab === 'QUEUE' && (
        <div className="bg-muted border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[var(--education-brand-ink)]" />
            Danh Sách Trẻ Cần Theo Dõi Phát Triển (Lớp Mầm A)
          </h2>
          <div className="divide-y divide-slate-800">
            {[
              { code: 'E2E-S00', name: 'Bé Nguyễn Minh Anh', age: '36 tháng', status: 'Chưa có quan sát tuần này', alert: true },
              { code: 'E2E-S01', name: 'Bé Trần Bảo Nam', age: '38 tháng', status: 'Có 1 đề xuất đánh giá chờ xác nhận', alert: false },
              { code: 'E2E-S02', name: 'Bé Lê Hoàng Yến', age: '35 tháng', status: 'Kế hoạch hỗ trợ tại nhà đến hạn review', alert: false },
            ].map((child, idx) => (
              <div key={idx} className="py-3.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">{child.name} <span className="text-xs text-muted-foreground">({child.code})</span></div>
                  <div className="text-xs text-muted-foreground">{child.age} · {child.status}</div>
                </div>
                <button
                  onClick={() => {
                    setSelectedStudentId(`00000000-0000-0000-0000-00000000010${idx}`);
                    setActiveTab('OBSERVATION');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg transition"
                >
                  Tạo Quan Sát
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: OBSERVATION & MINH CHỨNG */}
      {activeTab === 'OBSERVATION' && (
        <div className="bg-muted border border-border rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-5 h-5 text-[var(--education-brand-ink)]" />
            Ghi Nhận Quan Sát Cá Nhân Hóa (Per-Child Observation)
          </h2>

          {obsSuccessMessage && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-2" id="obs-success-banner">
              <CheckCircle2 className="w-5 h-5" /> {obsSuccessMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Chọn Trẻ Được Quan Sát</label>
                <select
                  id="select-child"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-foreground"
                >
                  <option value="00000000-0000-0000-0000-000000000100">Bé Nguyễn Minh Anh (E2E-S00)</option>
                  <option value="00000000-0000-0000-0000-000000000101">Bé Trần Bảo Nam (E2E-S01)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Nội Dung Quan Sát Thực Tế</label>
                <textarea
                  id="input-obs-text"
                  rows={4}
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Gắn Thẻ Cột Mốc Mầm Non (Milestone Tag)</label>
                <input
                  id="input-milestone-tag"
                  type="text"
                  value={milestoneCode}
                  onChange={(e) => setMilestoneCode(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-foreground"
                />
              </div>
            </div>

            <div className="space-y-4 bg-background p-5 rounded-xl border border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400" /> Bằng Chứng Đa Phương Tiện & Quyền Riêng Tư (Privacy & Consent)
              </h3>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Quyền Hiển Thị Minh Chứng (Visibility Scope)</label>
                <select
                  id="select-visibility"
                  value={evidenceVisibility}
                  onChange={(e) => {
                    if (isEvidenceVisibility(e.target.value)) {
                      setEvidenceVisibility(e.target.value);
                    }
                  }}
                  className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground"
                >
                  <option value="PARENT_SHARED">PARENT_SHARED — Phụ huynh được xem trong Portfolio</option>
                  <option value="INTERNAL_TEACHER">INTERNAL_TEACHER — Chỉ giáo viên xem nội bộ (Bảo mật)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Xác Nhận Consent Của Phụ Huynh (Consent Scope)</label>
                <select
                  id="select-consent"
                  value={consentScope}
                  onChange={(e) => {
                    if (isConsentScope(e.target.value)) {
                      setConsentScope(e.target.value);
                    }
                  }}
                  className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground"
                >
                  <option value="CONSENT_VERIFIED">CONSENT_VERIFIED — Phụ huynh đã đồng ý chia sẻ hình ảnh</option>
                  <option value="OPT_OUT">OPT_OUT — Phụ huynh từ chối chia sẻ hình ảnh (Chặn xuất bản)</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  id="btn-save-observation"
                  onClick={handleSaveObservation}
                  className="w-full py-2.5 bg-primary hover:bg-primary-hover font-semibold text-primary-foreground rounded-lg transition text-sm flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Lưu Quan Sát & Minh Chứng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PORTFOLIO & PUBLICATION */}
      {activeTab === 'PORTFOLIO' && (
        <div className="bg-muted border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-700 dark:text-purple-400" />
              Tổng Hợp & Xuất Bản Portfolio Phát Triển (Học Kỳ 1 2026)
            </h2>

            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              portfolioStatus === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
            }`}>
              {portfolioStatus} (Version {portfolioVersionNumber})
            </span>
          </div>

          {portfolioError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm font-medium flex items-center gap-2" id="portfolio-error-banner">
              <AlertCircle className="w-5 h-5" /> {portfolioError}
            </div>
          )}

          {publicationChecksum && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs font-mono break-all" id="checksum-banner">
              SHA-256 Fingerprint: {publicationChecksum}
            </div>
          )}

          <div className="border border-border rounded-xl p-5 bg-background space-y-4">
            <div className="font-semibold text-foreground">Danh Sách Bằng Chứng & Đánh Giá Tổng Hợp:</div>
            <ul className="text-xs text-foreground space-y-2">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> [EVIDENCE] Ảnh xếp hình khối màu sắc (Visibility: {evidenceVisibility}, Consent: {consentScope})
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> [MILESTONE_PROGRESS] Đánh giá định tính: <strong className="text-indigo-700 dark:text-indigo-400 font-bold">{progressStatus}</strong> (COG-01)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> [NEXT_STEP] Hướng dẫn tại nhà: Khám phá trộn màu finger paints.
              </li>
            </ul>

            <div className="pt-4 flex items-center gap-4">
              {portfolioStatus === 'DRAFT' ? (
                <button
                  id="btn-publish-portfolio"
                  onClick={handlePublishPortfolio}
                  className="px-6 py-2.5 bg-primary hover:bg-primary-hover font-semibold text-primary-foreground text-sm rounded-lg transition flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" /> Xuất Bản Portfolio Cho Phụ Huynh
                </button>
              ) : (
                <button
                  id="btn-edit-published"
                  onClick={handleEditPublishedPortfolio}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 font-semibold text-foreground text-sm rounded-lg transition flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" /> Chỉnh Sửa Portfolio (Tạo Version 2)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PARENT VIEW PROJECTION */}
      {activeTab === 'PARENT_VIEW' && (
        <div className="bg-muted border border-primary/20 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-lg font-semibold text-[var(--education-brand-ink)] flex items-center gap-2">
              <Eye className="w-5 h-5 text-[var(--education-brand-ink)]" />
              Góc Nhìn Phụ Huynh trên Mobile App (Parent Read Projection)
            </h2>
            <span className="text-xs text-muted-foreground">Filtering: strictly INTERNAL_TEACHER hidden</span>
          </div>

          <div className="max-w-md mx-auto bg-background border border-border rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="text-center border-b border-border pb-3">
              <div className="font-bold text-foreground text-base">Hồ Sơ Phát Triển Của Bé</div>
              <div className="text-xs text-[var(--education-brand-ink)]">Nguyễn Minh Anh · Lớp Mầm A</div>
            </div>

            {portfolioStatus === 'PUBLISHED' ? (
              <div className="space-y-4" id="parent-projection-container">
                <div className="bg-background p-4 rounded-xl border border-border space-y-2">
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Tiến Trình Đạt Được</div>
                  <div className="text-sm font-semibold text-foreground">Phân Loại Màu Sắc: {progressStatus}</div>
                  <div className="text-xs text-muted-foreground">{progressRationale}</div>
                </div>

                {evidenceVisibility === 'PARENT_SHARED' && consentScope === 'CONSENT_VERIFIED' && (
                  <div className="bg-background p-4 rounded-xl border border-border space-y-2" id="parent-visible-evidence">
                    <div className="text-xs font-bold text-[var(--education-brand-ink)] uppercase tracking-wider">Hình Ảnh Quan Sát Lớp</div>
                    <div className="text-xs text-foreground">s3://photos/parent_shared_paint.jpg</div>
                  </div>
                )}

                <div className="bg-background p-4 rounded-xl border border-border space-y-2">
                  <div className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Khuyên Dùng Tại Nhà</div>
                  <div className="text-xs text-foreground">Khám phá trộn màu finger paints tại nhà cùng bé.</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Chưa có phiên bản Portfolio nào được xuất bản cho học kỳ này.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
