import { z } from 'zod';
import { settlementDocumentSchema } from './AutoMoveSettlementContract';

export const adjustmentProducer = 'automove-recognition-adjustment-v1';
const signed = z.number().int().safe();
const common = { revision: z.string().regex(/^[a-f0-9]{64}$/), reason: z.string().trim().min(1).max(1000),
  document: settlementDocumentSchema, confirmed: z.literal(true) };
export const recognitionAdjustmentIntentSchema = z.discriminatedUnion('action', [
  z.object({ ...common, action: z.literal('price'), delta: signed.refine(value => value !== 0) }).strict(),
  z.object({ ...common, action: z.literal('cost'), delta: signed.refine(value => value !== 0) }).strict(),
  z.object({ ...common, action: z.literal('reverse') }).strict(),
]);
export type RecognitionAdjustmentIntent = z.infer<typeof recognitionAdjustmentIntentSchema>;
export const recognitionAdjustmentEntrySchema = z.object({
  id: z.string().uuid(), type: z.enum(['sale_revenue_adjusted', 'cost_basis_adjusted', 'sale_revenue_reversed']),
  saleDelta: signed, costDelta: signed, reason: z.string(), document: settlementDocumentSchema,
  periodId: z.string().uuid(), createdBy: z.string().uuid(), createdAt: z.string().datetime(),
});
export const recognitionAdjustmentStateSchema = z.object({
  recognitionId: z.string().uuid(), revision: z.string().regex(/^[a-f0-9]{64}$/),
  salePrice: signed.nonnegative(), costBasis: signed.nonnegative(), reversed: z.boolean(),
  policyId: z.string(), policyVersion: z.string(), entries: z.array(recognitionAdjustmentEntrySchema),
});
export type RecognitionAdjustmentState = z.infer<typeof recognitionAdjustmentStateSchema>;
