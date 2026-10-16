import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import type { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

/** Continue the UI-created sale; never seed recognition, receipts or adjustments. */
export async function continueAutoMoveRc(page: Page, db: Client, bookingId: string, bookingNumber: string, recognitionId: string, testInfo: TestInfo) {
  const immutable = async () => ({
    recognition: (await db.query('select * from public.auto_vehicle_sale_recognitions where id=$1', [recognitionId])).rows,
    snapshot: (await db.query('select * from public.auto_vehicle_sale_financial_snapshots where booking_id=$1 order by id', [bookingId])).rows,
    deposits: (await db.query('select * from public.auto_deposits where booking_id=$1 order by id', [bookingId])).rows,
    payments: (await db.query('select * from public.auto_vehicle_sale_payments where booking_id=$1 order by id', [bookingId])).rows,
  });
  const original = await immutable();
  const paymentUrl = `/api/bella-auto/bookings/${bookingId}/sale-payments`;
  const adjustmentUrl = `/api/bella-auto/bookings/${bookingId}/recognition-adjustments`;
  const settlementUrl = `/api/bella-auto/bookings/${bookingId}/settlement`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard/bella-auto/bookings');
  const open = async (cancelled = false) => {
    await page.getByRole('button', { name: cancelled ? 'Lịch sử hủy' : 'Thanh toán sau bán', exact: true }).click();
    await page.getByRole('row').filter({ hasText: bookingNumber }).getByRole('button', { name: `Hồ sơ bán xe ${bookingNumber}`, exact: true }).click();
  };
  const initialAdjustmentRead = page.waitForResponse(response => response.url().endsWith(adjustmentUrl) && response.request().method() === 'GET', { timeout: 60_000 });
  await open();
  const initial = await initialAdjustmentRead; expect(initial.status()).toBe(200);
  expect(await initial.json()).toMatchObject({ result: { recognitionId, salePrice: 1400000000, costBasis: 1000000000, reversed: false } });
  const dialog = page.getByRole('dialog');
  const adjustments = dialog.getByRole('region', { name: 'Điều chỉnh và đảo ghi nhận', exact: true });
  const settlement = dialog.getByRole('region', { name: 'Hoàn tiền và hủy giao dịch', exact: true });
  const document = async (panel: Locator, label: string, reasonLabel: string, reason: string, readyText: string) => {
    await panel.getByLabel(reasonLabel, { exact: true }).fill(reason);
    await panel.getByLabel(label, { exact: true }).setInputFiles({ name: 'accountant-confirmation.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from(`%PDF-1.4\nAccountant-confirmed RC fixture: ${reason}\n%%EOF\n`) });
    await expect(panel.getByText(readyText, { exact: true })).toBeVisible();
    await panel.getByRole('checkbox').check();
  };
  const adjust = async (mode: string, delta?: string) => {
    await adjustments.getByRole('radio', { name: mode, exact: true }).check();
    if (delta) await adjustments.getByLabel('Delta (VND)', { exact: true }).fill(delta);
    await document(adjustments, 'Chứng từ điều chỉnh', 'Lý do điều chỉnh', `RC confirmed ${mode}`, 'Đã tải chứng từ điều chỉnh');
    const response = page.waitForResponse(value => value.url().endsWith(adjustmentUrl) && value.request().method() === 'POST');
    await adjustments.getByRole('button', { name: mode === 'Đảo ghi nhận' ? 'Xác nhận đảo ghi nhận' : 'Xác nhận điều chỉnh', exact: true }).click();
    const saved = await response; expect(saved.status()).toBe(200);
    const retried = await page.request.post(adjustmentUrl, { headers: { 'Idempotency-Key': saved.request().headers()['idempotency-key'] }, data: saved.request().postDataJSON() });
    expect(retried.status()).toBe(200); expect(await retried.json()).toMatchObject({ result: { duplicate: true } });
    return saved.json();
  };
  await expect(adjustments.getByTestId('adjusted-sale')).toHaveText('1.400.000.000 VND');
  await adjust('Giá bán', '-100000000');
  await expect(adjustments.getByTestId('adjusted-sale')).toHaveText('1.300.000.000 VND');
  await adjust('Giá vốn', '50000000');
  await expect(adjustments.getByTestId('adjusted-cost')).toHaveText('1.050.000.000 VND');
  expect(await (await page.request.get(paymentUrl)).json()).toMatchObject({ result: {
    status: 'MATCHED', saleAmount: 1300000000, totalReceived: 1400000000, outstanding: -100000000, canCollect: false,
  } });

  const depositId = String(original.deposits.find(row => row.status === 'confirmed')?.id);
  await settlement.getByLabel('Receipt gốc', { exact: true }).selectOption(`deposit:${depositId}`);
  await settlement.getByLabel('Số tiền hoàn (VND)', { exact: true }).fill('100000000');
  await document(settlement, 'Chứng từ xác nhận hoàn/hủy', 'Lý do hoàn/hủy', 'RC documented excess-cash refund', 'Đã tải chứng từ hoàn/hủy');
  const refundResponse = page.waitForResponse(value => value.url().endsWith(settlementUrl) && value.request().method() === 'POST');
  await settlement.getByRole('button', { name: 'Xác nhận hoàn tiền', exact: true }).click();
  const refunded = await refundResponse; expect(refunded.status()).toBe(200);
  const refundIntent = refunded.request().postDataJSON() as Record<string, unknown>;
  const refundKey = refunded.request().headers()['idempotency-key'];
  expect(await (await page.request.post(settlementUrl, { headers: { 'Idempotency-Key': refundKey }, data: refundIntent })).json())
    .toMatchObject({ result: { duplicate: true, state: { refunded: 100000000, netReceived: 1300000000 } } });
  expect(await (await page.request.get(paymentUrl)).json()).toMatchObject({ result: { status: 'MATCHED', outstanding: 0 } });

  await settlement.getByRole('radio', { name: 'Hủy giao dịch', exact: true }).check();
  await document(settlement, 'Chứng từ xác nhận hoàn/hủy', 'Lý do hoàn/hủy', 'RC documented cancellation after handover', 'Đã tải chứng từ hoàn/hủy');
  const cancelResponse = page.waitForResponse(value => value.url().endsWith(settlementUrl) && value.request().method() === 'POST');
  await settlement.getByRole('button', { name: 'Xác nhận hủy giao dịch', exact: true }).click();
  const cancelled = await cancelResponse; expect(cancelled.status()).toBe(200);
  await expect(settlement.getByTestId('refund-booking-status')).toHaveText('cancelled');
  expect((await db.query('select adjustment_type from public.auto_vehicle_sale_recognition_adjustments where recognition_id=$1', [recognitionId])).rows).toHaveLength(2);
  expect((await db.query('select status from public.auto_vehicles where id=$1', [original.recognition[0].vehicle_id])).rows[0].status).toBe('delivered');
  await expect(settlement.getByTestId('refund-total')).toHaveText('100.000.000 VND');
  await expect(adjustments.getByTestId('recognition-adjustment-status')).toHaveText('Đang hiệu lực');
  const cancelRetry = await page.request.post(settlementUrl, { headers: { 'Idempotency-Key': cancelled.request().headers()['idempotency-key'] }, data: cancelled.request().postDataJSON() });
  expect(cancelRetry.status()).toBe(200); expect(await cancelRetry.json()).toMatchObject({ result: { duplicate: true } });

  await adjust('Đảo ghi nhận');
  await expect(adjustments.getByTestId('adjusted-sale')).toHaveText('0 VND');
  await expect(adjustments.getByTestId('adjusted-cost')).toHaveText('0 VND');
  expect(await (await page.request.get(paymentUrl)).json()).toMatchObject({ result: {
    status: 'MATCHED', saleAmount: 0, totalReceived: 1300000000, outstanding: -1300000000, canCollect: false,
  } });
  // Reversal is not a refund. Each remaining manual refund cites its real receipt.
  for (const receipt of original.payments) {
    const key = randomUUID(), data = { ...refundIntent, receiptType: 'post_sale', receiptId: receipt.id, amount: Number(receipt.amount), reason: 'RC confirmed remaining receipt refund after separate reversal' };
    const saved = await page.request.post(settlementUrl, { headers: { 'Idempotency-Key': key }, data });
    expect(saved.status()).toBe(200);
    const retry = await page.request.post(settlementUrl, { headers: { 'Idempotency-Key': key }, data });
    expect(retry.status()).toBe(200); expect(await retry.json()).toMatchObject({ result: { duplicate: true } });
  }
  expect(await immutable()).toEqual(original);
  const final = await page.request.get(paymentUrl); expect(final.status()).toBe(200);
  expect(await final.json()).toMatchObject({ result: { status: 'MATCHED', saleAmount: 0, totalReceived: 0,
    refundedTotal: 1400000000, outstanding: 0, canCollect: false } });
  const actions = (await db.query('select action_type,amount from public.auto_vehicle_sale_settlement_actions where booking_id=$1', [bookingId])).rows;
  expect(actions.filter(row => row.action_type === 'cancel')).toHaveLength(1);
  expect(actions.filter(row => row.action_type === 'refund').reduce((sum, row) => sum + Number(row.amount), 0)).toBe(1400000000);
  expect((await db.query('select id from public.auto_vehicle_sale_recognition_adjustments where recognition_id=$1', [recognitionId])).rows).toHaveLength(3);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.goto('/dashboard/bella-auto');
  await expect(page.getByTestId('recognized-sales-current-month')).toContainText('0 VNĐ');
  const revenue = await page.request.get('/api/bella-auto/analytics/recognized-sales'); expect(revenue.status()).toBe(200);
  const report = await revenue.json(); expect(report.revenueByMonth.every((month: { revenue: number; sales: number }) => month.revenue === 0 && month.sales === 0)).toBe(true);
  expect(report.topModels).toEqual([]);
  await page.goto('/dashboard/bella-auto/bookings'); await open(true);
  await expect(adjustments.getByTestId('recognition-adjustment-status')).toHaveText('Đã đảo ghi nhận');
  await expect(settlement.getByTestId('refund-net')).toHaveText('0 VND');
  await expect(settlement.getByTestId('refund-total')).toHaveText('1.400.000.000 VND');
  await adjustments.scrollIntoViewIfNeeded(); await page.screenshot({ path: testInfo.outputPath('rc-final-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 }); await adjustments.scrollIntoViewIfNeeded();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('rc-final-mobile.png') });
  const proof = { sha: process.env.AUTOMOVE_RC_SHA, buildId: process.env.AUTOMOVE_RC_BUILD_ID, bookingId, recognitionId,
    finalSale: 0, finalCash: 0, finalOutstanding: 0, originalUnchanged: true, reconciliation: 'MATCHED', cleanup: 'PARTIAL_HISTORY_RETAINED' };
  if (!process.env.AUTOMOVE_RC_PROOF_PATH) throw Error('RC evidence destination required');
  writeFileSync(process.env.AUTOMOVE_RC_PROOF_PATH, JSON.stringify(proof, null, 2));
  await testInfo.attach('rc-business-chain-proof', { contentType: 'application/json', body: Buffer.from(JSON.stringify(proof)) });
  console.log('AUTOMOVE_RC_SAME_BOOKING_RECEIPTS_ADJUST_REFUND_CANCEL_REVERSE_RECONCILE=PASS');
}
