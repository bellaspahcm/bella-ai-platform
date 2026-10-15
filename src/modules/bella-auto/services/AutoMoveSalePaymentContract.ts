import { z } from 'zod';

const money = z.number().int().nonnegative().safe();
export const salePaymentIntentSchema = z.object({
  amount: money.positive(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card']),
  transactionRef: z.string().trim().min(1).max(200).nullable(),
  notes: z.string().trim().min(1).max(1000).nullable(),
}).strict().refine(value => value.paymentMethod === 'cash' || value.transactionRef !== null,
  { message: 'Bank/card receipts require a transaction reference.' });
export const salePaymentReceiptSchema = z.object({
  id: z.string().uuid(), idempotencyKey: z.string().uuid(), amount: money.positive(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card']), transactionRef: z.string().nullable(),
  notes: z.string().nullable(), receivedBy: z.string().uuid(), receivedAt: z.string().datetime(),
});
export const salePaymentStateSchema = z.object({
  bookingId: z.string().uuid(), recognitionId: z.string().uuid().nullable(),
  status: z.enum(['NOT_RECOGNIZED', 'MATCHED', 'MISMATCH']), issues: z.array(z.string()),
  saleAmount: money, depositReceived: money, postSaleReceived: money, totalReceived: money,
  refundedTotal: money,
  outstanding: z.number().int().safe(), canCollect: z.boolean(),
  receipts: z.array(salePaymentReceiptSchema),
});
export type SalePaymentIntent = z.infer<typeof salePaymentIntentSchema>;
export type SalePaymentReceipt = z.infer<typeof salePaymentReceiptSchema>;
export type SalePaymentState = z.infer<typeof salePaymentStateSchema>;
