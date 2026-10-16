'use client';

import { FormEvent, useEffect, useMemo, useState, useTransition } from 'react';
import { Building2, GitFork, Plus, RefreshCw, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import {
  assignBeautyStaffToBranch,
  createBeautyBranch,
  createBeautyCompany,
  getBeautyChainSnapshot,
  linkBeautyStaffPerson,
  type BeautyChainBranch,
  type BeautyChainSnapshot,
} from '@/services/beauty-chain-actions';

type CompanyForm = {
  name: string;
  code: string;
};

type BranchForm = {
  name: string;
  code: string;
};

export function BeautyChainManagementClient() {
  const [snapshot, setSnapshot] = useState<BeautyChainSnapshot | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyForm>({ name: '', code: '' });
  const [branchForm, setBranchForm] = useState<BranchForm>({ name: '', code: '' });
  const [selectedStaffUserId, setSelectedStaffUserId] = useState('');
  const [isPending, startTransition] = useTransition();

  async function loadSnapshot() {
    const result = await getBeautyChainSnapshot();
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setSnapshot(result.data);
    setSelectedBranchId((current) => current ?? result.data.branches[0]?.id ?? null);
  }

  useEffect(() => {
    startTransition(() => {
      void loadSnapshot();
    });
  }, []);

  const selectedBranch = useMemo(
    () => snapshot?.branches.find((branch) => branch.id === selectedBranchId) ?? null,
    [snapshot, selectedBranchId],
  );

  const staffForSelectedBranch = useMemo(() => {
    if (!snapshot || !selectedBranch) return [];
    return snapshot.staff.filter((member) => member.branchIds.includes(selectedBranch.id));
  }, [snapshot, selectedBranch]);

  const assignableStaff = useMemo(() => {
    if (!snapshot || !selectedBranch) return [];
    return snapshot.staff.filter((member) => !member.branchIds.includes(selectedBranch.id));
  }, [snapshot, selectedBranch]);

  function runMutation<T>(action: () => Promise<{ success: true; data: T } | { success: false; error: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      await loadSnapshot();
    });
  }

  function handleCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runMutation(
      () => createBeautyCompany({ name: companyForm.name, code: companyForm.code }),
      'Đã tạo Company cho tenant',
    );
    setCompanyForm({ name: '', code: '' });
  }

  function handleCreateBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot?.company) {
      toast.error('Cần tạo Company trước khi thêm chi nhánh');
      return;
    }
    const companyId = snapshot.company.id;
    runMutation(
      () => createBeautyBranch({
        name: branchForm.name,
        code: branchForm.code,
        companyId,
      }),
      'Đã tạo chi nhánh',
    );
    setBranchForm({ name: '', code: '' });
  }

  function handleAssignStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBranch) {
      toast.error('Vui lòng chọn chi nhánh');
      return;
    }
    if (!selectedStaffUserId) {
      toast.error('Vui lòng chọn nhân sự');
      return;
    }
    runMutation(
      async () => {
        const linked = await linkBeautyStaffPerson({ userId: selectedStaffUserId });
        if (!linked.success) return linked;
        return assignBeautyStaffToBranch({
          userId: selectedStaffUserId,
          branchId: selectedBranch.id,
        });
      },
      'Đã gán nhân sự vào chi nhánh',
    );
    setSelectedStaffUserId('');
  }

  const empty = !snapshot;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              <GitFork className="size-4" />
              Beauty V2
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">Chain Management</h1>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => startTransition(() => void loadSnapshot())}
            disabled={isPending}
          >
            <RefreshCw className="size-4" />
            Làm mới
          </Button>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Thông tin doanh nghiệp</p>
                <p className="text-xs text-slate-500">Company gốc của tenant Beauty V2.</p>
              </div>
              {snapshot?.company ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Chưa tạo</Badge>}
            </div>

            {snapshot?.company ? (
              <div className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50 p-4">
                <Building2 className="size-9 rounded-md bg-white p-2 text-slate-600" />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-950">{snapshot.company.name}</p>
                  <p className="text-xs text-slate-500">{snapshot.company.code || 'Chưa có mã Company'}</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateCompany} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
                <Input
                  value={companyForm.name}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Bella Beauty"
                  disabled={isPending}
                />
                <Input
                  value={companyForm.code}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="BELLA"
                  disabled={isPending}
                />
                <Button type="submit" disabled={isPending}>
                  <Plus className="size-4" />
                  Tạo
                </Button>
              </form>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-950">Tổng quan chuỗi</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Metric label="Company" value={snapshot?.company ? 1 : 0} />
              <Metric label="Chi nhánh" value={snapshot?.branches.length ?? 0} />
              <Metric label="Nhân sự" value={snapshot?.staff.length ?? 0} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Chi nhánh</p>
                <p className="text-xs text-slate-500">Company → Branch cho MVP.</p>
              </div>
              <Badge variant="outline">{snapshot?.branches.length ?? 0}</Badge>
            </div>

            <div className="flex flex-col gap-2">
              {empty && <p className="text-sm text-slate-500">Đang tải dữ liệu...</p>}
              {snapshot?.branches.map((branch) => (
                <BranchButton
                  key={branch.id}
                  branch={branch}
                  selected={branch.id === selectedBranchId}
                  onSelect={() => setSelectedBranchId(branch.id)}
                />
              ))}
              {snapshot && snapshot.branches.length === 0 && (
                <p className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Chưa có chi nhánh.
                </p>
              )}
            </div>

            <form onSubmit={handleCreateBranch} className="mt-4 grid gap-2 border-t border-slate-100 pt-4">
              <Input
                value={branchForm.name}
                onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Bella Spa Quận 1"
                disabled={isPending || !snapshot?.company}
              />
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Input
                  value={branchForm.code}
                  onChange={(event) => setBranchForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="Q1"
                  disabled={isPending || !snapshot?.company}
                />
                <Button type="submit" disabled={isPending || !snapshot?.company}>
                  <Plus className="size-4" />
                  Thêm chi nhánh
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            {selectedBranch ? (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Chi nhánh</p>
                    <h2 className="text-xl font-semibold text-slate-950">{selectedBranch.name}</h2>
                    <p className="text-xs text-slate-500">{selectedBranch.code || 'Chưa có mã chi nhánh'}</p>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-slate-500" />
                      <p className="text-sm font-semibold text-slate-950">Nhân sự</p>
                    </div>
                    <Badge variant="outline">{staffForSelectedBranch.length}</Badge>
                  </div>

                  <div className="overflow-hidden rounded-md border border-slate-200">
                    <table className="w-full table-fixed text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Tên</th>
                          <th className="px-3 py-2 font-semibold">Role</th>
                          <th className="px-3 py-2 font-semibold">Access</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffForSelectedBranch.map((member) => (
                          <tr key={member.userId} className="border-t border-slate-100">
                            <td className="px-3 py-2">
                              <p className="truncate font-medium text-slate-900">{member.fullName}</p>
                              <p className="truncate text-xs text-slate-500">{member.email}</p>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{member.role}</td>
                            <td className="px-3 py-2">
                              <Badge variant={member.personId ? 'secondary' : 'outline'}>
                                {member.personId ? 'Linked' : 'Needs link'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                        {staffForSelectedBranch.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-500">
                              Chưa có nhân sự ở chi nhánh này.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <form onSubmit={handleAssignStaff} className="grid gap-2 border-t border-slate-100 pt-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <PremiumSelect
                    value={selectedStaffUserId}
                    onChange={setSelectedStaffUserId}
                    options={[
                      { value: '', label: 'Chọn nhân sự' },
                      ...assignableStaff.map((member) => ({
                        value: member.userId,
                        label: `${member.fullName} - ${member.role}`,
                      })),
                    ]}
                    ariaLabel="Chọn nhân sự gán vào chi nhánh"
                    className="space-y-0"
                    buttonClassName="h-9 rounded-lg border-slate-200 bg-white px-2.5 py-2 text-sm shadow-none hover:border-slate-400"
                    dropdownClassName="min-w-full"
                    disabled={isPending || assignableStaff.length === 0}
                  />
                  <Button type="submit" disabled={isPending || !selectedStaffUserId}>
                    <UserPlus className="size-4" />
                    Gán vào chi nhánh
                  </Button>
                </form>
              </div>
            ) : (
              <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-slate-200 text-sm text-slate-500">
                Chọn hoặc tạo chi nhánh để quản lý nhân sự.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function BranchButton({
  branch,
  selected,
  onSelect,
}: {
  branch: BeautyChainBranch;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border p-3 text-left transition ${
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-slate-200 bg-white text-slate-950 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{branch.name}</p>
          <p className={`text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{branch.code || 'No code'}</p>
        </div>
        <span className={`shrink-0 text-xs ${selected ? 'text-slate-200' : 'text-slate-500'}`}>
          {branch.staffCount} nhân sự
        </span>
      </div>
    </button>
  );
}
