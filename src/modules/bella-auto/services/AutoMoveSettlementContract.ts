import { z } from 'zod';

export const settlementDocumentSchema = z.object({
  bucket: z.literal('automove-sale-documents'),
  path: z.string().min(1).max(1000), sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
const common = { reason: z.string().trim().min(1).max(1000),
  document: settlementDocumentSchema, confirmed: z.literal(true) };
export const settlementIntentSchema = z.discriminatedUnion('action', [
  z.object({ ...common, action: z.literal('refund'), receiptType: z.enum(['deposit','post_sale']),
    receiptId: z.string().uuid(), amount: z.number().int().safe().positive() }).strict(),
  z.object({ ...common, action: z.literal('cancel') }).strict(),
]);
export type SettlementIntent = z.infer<typeof settlementIntentSchema>;
export const settlementActionSchema = z.object({
  id: z.string().uuid(), action: z.enum(['refund','cancel']), amount: z.number().int().safe().nonnegative(),
  receiptType: z.enum(['deposit','post_sale']).nullable(), receiptId: z.string().uuid().nullable(),
  reason: z.string(), document: settlementDocumentSchema, createdBy: z.string().uuid(), createdAt: z.string().datetime(),
});
export const settlementStateSchema = z.object({
  bookingId: z.string().uuid(), bookingStatus: z.string(), vehicleStatus: z.string().nullable(),
  recognitionId: z.string().uuid().nullable(), grossReceived: z.number().int().safe().nonnegative(),
  refunded: z.number().int().safe().nonnegative(), netReceived: z.number().int().safe().nonnegative(),
  canCancel: z.boolean(), issues: z.array(z.string()),
  receipts: z.array(z.object({ id: z.string().uuid(), type: z.enum(['deposit','post_sale']),
    amount: z.number().int().safe().positive(), refunded: z.number().int().safe().nonnegative(),
    refundable: z.number().int().safe().nonnegative() })),
  actions: z.array(settlementActionSchema),
});
export type SettlementState = z.infer<typeof settlementStateSchema>;
