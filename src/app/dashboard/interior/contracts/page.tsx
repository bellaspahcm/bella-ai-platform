'use client';

import React, { useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ContractStatus = 'draft' | 'signed' | 'active' | 'completed' | 'terminated';
type MilestoneStatus = 'pending' | 'invoiced' | 'paid' | 'overdue';

interface Contract {
  id: string;
  projectName: string;
  client: string;
  contractValue: number;
  signedDate: string;
  status: ContractStatus;
}

interface PaymentMilestone {
  id: string;
  contractId: string;
  name: string;
  percentage: number;
  amount: number;
  dueDate: string;
  status: MilestoneStatus;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const CONTRACTS: Contract[] = [
  {
    id: 'C-001',
    projectName: 'Al Noor Villa — Full Interior',
    client: 'Ahmed Al Mansoori',
    contractValue: 485000,
    signedDate: '2024-03-10',
    status: 'active',
  },
  {
    id: 'C-002',
    projectName: 'Skyline Penthouse Fit-Out',
    client: 'Sara Khalid',
    contractValue: 320000,
    signedDate: '2024-04-02',
    status: 'active',
  },
  {
    id: 'C-003',
    projectName: 'Marina Office Renovation',
    client: 'Gulf Dynamics LLC',
    contractValue: 215000,
    signedDate: '2024-01-20',
    status: 'completed',
  },
  {
    id: 'C-004',
    projectName: 'Desert Rose Resort — Lobby',
    client: 'Reem Hospitality',
    contractValue: 780000,
    signedDate: '2024-05-15',
    status: 'signed',
  },
  {
    id: 'C-005',
    projectName: 'Garden Villas Phase 2',
    client: 'Nasser Development',
    contractValue: 650000,
    signedDate: '',
    status: 'draft',
  },
  {
    id: 'C-006',
    projectName: 'Old Town Boutique Hotel',
    client: 'Heritage Stays',
    contractValue: 420000,
    signedDate: '2023-11-05',
    status: 'terminated',
  },
];

const MILESTONES: PaymentMilestone[] = [
  { id: 'M-001-1', contractId: 'C-001', name: 'Deposit', percentage: 30, amount: 145500, dueDate: '2024-03-15', status: 'paid' },
  { id: 'M-001-2', contractId: 'C-001', name: 'Design Approval', percentage: 20, amount: 97000, dueDate: '2024-04-10', status: 'paid' },
  { id: 'M-001-3', contractId: 'C-001', name: 'Production Start', percentage: 30, amount: 145500, dueDate: '2024-05-20', status: 'invoiced' },
  { id: 'M-001-4', contractId: 'C-001', name: 'Site Completion', percentage: 15, amount: 72750, dueDate: '2024-07-01', status: 'pending' },
  { id: 'M-001-5', contractId: 'C-001', name: 'Final Handover', percentage: 5, amount: 24250, dueDate: '2024-07-20', status: 'pending' },

  { id: 'M-002-1', contractId: 'C-002', name: 'Deposit', percentage: 30, amount: 96000, dueDate: '2024-04-05', status: 'paid' },
  { id: 'M-002-2', contractId: 'C-002', name: 'Design Approval', percentage: 20, amount: 64000, dueDate: '2024-05-01', status: 'invoiced' },
  { id: 'M-002-3', contractId: 'C-002', name: 'Production Start', percentage: 30, amount: 96000, dueDate: '2024-06-15', status: 'pending' },
  { id: 'M-002-4', contractId: 'C-002', name: 'Site Completion', percentage: 15, amount: 48000, dueDate: '2024-08-01', status: 'pending' },
  { id: 'M-002-5', contractId: 'C-002', name: 'Final Handover', percentage: 5, amount: 16000, dueDate: '2024-08-15', status: 'pending' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `AED ${value.toLocaleString('en-AE')}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
}

const CONTRACT_STATUS_STYLES: Record<ContractStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  signed: 'bg-sky-100 text-sky-700',
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-amber-100 text-amber-700',
  terminated: 'bg-red-100 text-red-700',
};

const MILESTONE_STATUS_STYLES: Record<MilestoneStatus, string> = {
  pending: 'bg-zinc-100 text-zinc-500',
  invoiced: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
};

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

function SummaryCard({ label, value, sub, accent = 'border-amber-400' }: SummaryCardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-zinc-100 border-l-4 ${accent} p-5 flex flex-col gap-1`}>
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-zinc-800">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const [selectedContractId, setSelectedContractId] = useState<string>(CONTRACTS[0].id);
  const [milestones, setMilestones] = useState<PaymentMilestone[]>(MILESTONES);

  const selectedContract = CONTRACTS.find((c) => c.id === selectedContractId) ?? CONTRACTS[0];
  const selectedMilestones = milestones.filter((m) => m.contractId === selectedContractId);

  // Summary calculations
  const totalValue = CONTRACTS.reduce((s, c) => s + c.contractValue, 0);
  const collected = milestones.filter((m) => m.status === 'paid').reduce((s, m) => s + m.amount, 0);
  const outstanding = milestones.filter((m) => m.status !== 'paid').reduce((s, m) => s + m.amount, 0);
  const overdueCount = milestones.filter((m) => m.status === 'overdue').length;

  function markMilestonePaid(milestoneId: string) {
    setMilestones((prev) =>
      prev.map((m) => (m.id === milestoneId ? { ...m, status: 'paid' } : m))
    );
  }

  return (
    <div className="min-h-screen bg-amber-50/40 p-6 font-sans">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Contracts &amp; Milestones</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage client agreements and track payment schedules</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total Contract Value" value={formatCurrency(totalValue)} sub={`${CONTRACTS.length} contracts`} accent="border-amber-400" />
        <SummaryCard label="Collected Amount" value={formatCurrency(collected)} sub="Paid milestones" accent="border-emerald-400" />
        <SummaryCard label="Outstanding Amount" value={formatCurrency(outstanding)} sub="Pending &amp; invoiced" accent="border-sky-400" />
        <SummaryCard label="Overdue Milestones" value={String(overdueCount)} sub="Require attention" accent="border-red-400" />
      </div>

      {/* Contracts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-700">All Contracts</h2>
          <button className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + New Contract
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-amber-50/60 text-xs text-zinc-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Project Name</th>
                <th className="px-5 py-3 text-left">Client</th>
                <th className="px-5 py-3 text-right">Contract Value</th>
                <th className="px-5 py-3 text-left">Signed Date</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {CONTRACTS.map((contract, idx) => (
                <tr
                  key={contract.id}
                  className={`border-t border-zinc-50 hover:bg-amber-50/40 transition-colors cursor-pointer ${
                    selectedContractId === contract.id ? 'bg-amber-50' : idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'
                  }`}
                  onClick={() => setSelectedContractId(contract.id)}
                >
                  <td className="px-5 py-3.5 font-medium text-zinc-800">{contract.projectName}</td>
                  <td className="px-5 py-3.5 text-zinc-600">{contract.client}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-zinc-800">{formatCurrency(contract.contractValue)}</td>
                  <td className="px-5 py-3.5 text-zinc-500">{formatDate(contract.signedDate)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${CONTRACT_STATUS_STYLES[contract.status]}`}>
                      {contract.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      className="text-amber-600 hover:text-amber-800 font-medium text-xs underline underline-offset-2"
                      onClick={(e) => { e.stopPropagation(); setSelectedContractId(contract.id); }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Milestones */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-700">Payment Milestones</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {selectedContract.projectName} — {selectedContract.client}
            </p>
          </div>
        </div>

        {selectedMilestones.length === 0 ? (
          <div className="px-6 py-10 text-center text-zinc-400 text-sm">
            No milestones defined for this contract yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-50/60 text-xs text-zinc-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Milestone</th>
                  <th className="px-5 py-3 text-right">%</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-left">Due Date</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {selectedMilestones.map((ms) => (
                  <tr key={ms.id} className="border-t border-zinc-50 hover:bg-amber-50/30 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-zinc-800">{ms.name}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-500 font-mono">{ms.percentage}%</td>
                    <td className="px-5 py-3.5 text-right font-mono text-zinc-800">{formatCurrency(ms.amount)}</td>
                    <td className="px-5 py-3.5 text-zinc-500">{formatDate(ms.dueDate)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${MILESTONE_STATUS_STYLES[ms.status]}`}>
                        {ms.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {ms.status !== 'paid' ? (
                        <button
                          className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                          onClick={() => markMilestonePaid(ms.id)}
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-300 italic">Paid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-amber-100 bg-amber-50/40">
                  <td className="px-5 py-3 font-semibold text-zinc-700" colSpan={2}>Total</td>
                  <td className="px-5 py-3 text-right font-bold font-mono text-amber-700">
                    {formatCurrency(selectedMilestones.reduce((s, m) => s + m.amount, 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
