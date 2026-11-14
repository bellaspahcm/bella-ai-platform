import type { Metadata } from 'next';
import CustomerApprovalClient from './customer-approval-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Xác nhận hồ sơ thương mại',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};

export default async function CustomerApprovalPage({
  params,
}: {
  params: Promise<{ approvalId: string }>;
}) {
  const { approvalId } = await params;
  return <CustomerApprovalClient approvalId={approvalId} />;
}
