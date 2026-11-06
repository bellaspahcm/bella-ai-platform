'use client';

interface ProjectPL {
  id: string;
  project: string;
  client: string;
  contractRevenue: number;
  materialCost: number;
  laborCost: number;
  cashCollected: number;
}

interface MonthlyCashFlow {
  month: string;
  invoiced: number;
  collected: number;
}

const MOCK_PROJECTS: ProjectPL[] = [
  {
    id: 'P-001',
    project: 'Villa Harmonia — Full Interior',
    client: 'Siti Rahayu',
    contractRevenue: 850_000_000,
    materialCost: 320_000_000,
    laborCost: 148_000_000,
    cashCollected: 680_000_000,
  },
  {
    id: 'P-002',
    project: 'Kaffah Office Tower — L12–L14',
    client: 'PT Kaffah Properti',
    contractRevenue: 1_200_000_000,
    materialCost: 510_000_000,
    laborCost: 215_000_000,
    cashCollected: 960_000_000,
  },
  {
    id: 'P-003',
    project: 'The Orchard Penthouse',
    client: 'Budi Santoso',
    contractRevenue: 480_000_000,
    materialCost: 220_000_000,
    laborCost: 95_000_000,
    cashCollected: 480_000_000,
  },
  {
    id: 'P-004',
    project: 'Greenview Boutique Hotel — Lobby',
    client: 'CV Greenview Resort',
    contractRevenue: 630_000_000,
    materialCost: 310_000_000,
    laborCost: 130_000_000,
    cashCollected: 315_000_000,
  },
  {
    id: 'P-005',
    project: 'Sunrise Mall Food Court Reno',
    client: 'Sunrise Mall Management',
    contractRevenue: 390_000_000,
    materialCost: 195_000_000,
    laborCost: 78_000_000,
    cashCollected: 390_000_000,
  },
];

const MOCK_CASH_FLOW: MonthlyCashFlow[] = [
  { month: 'Jun 2026', invoiced: 620_000_000, collected: 480_000_000 },
  { month: 'Jul 2026', invoiced: 740_000_000, collected: 650_000_000 },
  { month: 'Aug 2026', invoiced: 890_000_000, collected: 780_000_000 },
  { month: 'Sep 2026', invoiced: 1_050_000_000, collected: 920_000_000 },
  { month: 'Oct 2026', invoiced: 980_000_000, collected: 850_000_000 },
  { month: 'Nov 2026', invoiced: 760_000_000, collected: 530_000_000 },
];

function formatIDR(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function computeRow(p: ProjectPL) {
  const totalCOGS = p.materialCost + p.laborCost;
  const grossProfit = p.contractRevenue - totalCOGS;
  const grossMargin = p.contractRevenue > 0 ? (grossProfit / p.contractRevenue) * 100 : 0;
  const outstanding = p.contractRevenue - p.cashCollected;
  return { totalCOGS, grossProfit, grossMargin, outstanding };
}

function MarginBadge({ pct }: { pct: number }) {
  if (pct >= 40) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        {pct.toFixed(1)}%
      </span>
    );
  }
  if (pct >= 25) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
        {pct.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      {pct.toFixed(1)}%
    </span>
  );
}

export default function FinancePage() {
  const rows = MOCK_PROJECTS.map((p) => ({ ...p, ...computeRow(p) }));

  const totals = rows.reduce(
    (acc, r) => ({
      contractRevenue: acc.contractRevenue + r.contractRevenue,
      totalCOGS: acc.totalCOGS + r.totalCOGS,
      grossProfit: acc.grossProfit + r.grossProfit,
      cashCollected: acc.cashCollected + r.cashCollected,
    }),
    { contractRevenue: 0, totalCOGS: 0, grossProfit: 0, cashCollected: 0 }
  );

  const avgGrossMargin =
    totals.contractRevenue > 0 ? (totals.grossProfit / totals.contractRevenue) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Project Finance</h1>
        <p className="mt-1 text-sm text-gray-500">
          P&amp;L overview across all active and completed interior projects. Finance data synced via
          outbox — no direct ledger writes.
        </p>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Contract Revenue"
          value={formatIDR(totals.contractRevenue)}
          color="indigo"
        />
        <SummaryCard
          label="Total COGS"
          value={formatIDR(totals.totalCOGS)}
          sub="Materials + Labor"
          color="gray"
        />
        <SummaryCard
          label="Gross Profit"
          value={formatIDR(totals.grossProfit)}
          color="emerald"
        />
        <SummaryCard
          label="Avg Gross Margin"
          value={`${avgGrossMargin.toFixed(1)}%`}
          color={avgGrossMargin >= 40 ? 'emerald' : avgGrossMargin >= 25 ? 'yellow' : 'red'}
        />
      </div>

      {/* P&L Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Project P&amp;L Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Project</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-right">Contract Rev.</th>
                <th className="px-4 py-3 text-right">Material Cost</th>
                <th className="px-4 py-3 text-right">Labor Cost</th>
                <th className="px-4 py-3 text-right">Total COGS</th>
                <th className="px-4 py-3 text-right">Gross Profit</th>
                <th className="px-4 py-3 text-center">Margin %</th>
                <th className="px-4 py-3 text-right">Cash Collected</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.project}</p>
                    <p className="text-xs text-gray-400">{r.id}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.client}</td>
                  <td className="px-4 py-3 text-right text-gray-800 font-medium">
                    {formatIDR(r.contractRevenue)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatIDR(r.materialCost)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatIDR(r.laborCost)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">
                    {formatIDR(r.totalCOGS)}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-semibold">
                    {formatIDR(r.grossProfit)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <MarginBadge pct={r.grossMargin} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatIDR(r.cashCollected)}</td>
                  <td className="px-4 py-3 text-right text-orange-600 font-medium">
                    {formatIDR(r.outstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot className="bg-gray-50 font-semibold text-sm text-gray-700 border-t-2 border-gray-200">
              <tr>
                <td className="px-4 py-3" colSpan={2}>
                  Portfolio Total
                </td>
                <td className="px-4 py-3 text-right">{formatIDR(totals.contractRevenue)}</td>
                <td className="px-4 py-3" colSpan={2} />
                <td className="px-4 py-3 text-right">{formatIDR(totals.totalCOGS)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">
                  {formatIDR(totals.grossProfit)}
                </td>
                <td className="px-4 py-3 text-center">
                  <MarginBadge pct={avgGrossMargin} />
                </td>
                <td className="px-4 py-3 text-right">{formatIDR(totals.cashCollected)}</td>
                <td className="px-4 py-3 text-right text-orange-600">
                  {formatIDR(totals.contractRevenue - totals.cashCollected)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Monthly Cash Flow */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Monthly Cash Flow — Last 6 Months</h2>
          <p className="text-xs text-gray-500 mt-0.5">Invoiced vs Collected comparison</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Month</th>
                <th className="px-4 py-3 text-right">Invoiced</th>
                <th className="px-4 py-3 text-right">Collected</th>
                <th className="px-4 py-3 text-right">Collection Rate</th>
                <th className="px-4 py-3 text-right">Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_CASH_FLOW.map((cf) => {
                const rate = cf.invoiced > 0 ? (cf.collected / cf.invoiced) * 100 : 0;
                const gap = cf.invoiced - cf.collected;
                return (
                  <tr key={cf.month} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{cf.month}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatIDR(cf.invoiced)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                      {formatIDR(cf.collected)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-xs font-semibold ${
                          rate >= 90
                            ? 'text-green-600'
                            : rate >= 70
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatIDR(gap)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-400 italic">
        ⓘ Finance data synced via outbox — no direct ledger writes. All amounts in IDR.
      </p>
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  sub?: string;
  color: 'indigo' | 'gray' | 'emerald' | 'yellow' | 'red';
}

function SummaryCard({ label, value, sub, color }: SummaryCardProps) {
  const colorMap: Record<SummaryCardProps['color'], string> = {
    indigo: 'text-indigo-700',
    gray: 'text-gray-700',
    emerald: 'text-emerald-700',
    yellow: 'text-yellow-700',
    red: 'text-red-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      <p className={`mt-2 text-xl font-bold ${colorMap[color]}`}>{value}</p>
    </div>
  );
}
