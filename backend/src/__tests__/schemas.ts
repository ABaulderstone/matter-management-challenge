import { z } from 'zod';

export const TextFieldSchema = z.object({
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  fieldType: z.literal('text'),
  value: z.string(),
  displayValue: z.string().optional(),
});

export const NumberFieldSchema = z.object({
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  fieldType: z.literal('number'),
  value: z.number(),
  displayValue: z.string(),
});

export const UserFieldSchema = z.object({
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  fieldType: z.literal('user'),
  value: z.object({
    id: z.number(),
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    displayName: z.string(),
  }),
  displayValue: z.string(),
});

export const CurrencyFieldSchema = z.object({
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  fieldType: z.literal('currency'),
  value: z.object({
    amount: z.number(),
    currency: z.string(),
  }),
  displayValue: z.string(),
});

export const BooleanFieldSchema = z.object({
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  fieldType: z.literal('boolean'),
  value: z.boolean(),
  displayValue: z.string(),
});

export const DateFieldSchema = z.object({
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  fieldType: z.literal('date'),
  value: z.string().datetime(),
  displayValue: z.string(),
});

export const SelectFieldSchema = z.object({
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  fieldType: z.literal('select'),
  value: z.string().uuid(),
  displayValue: z.string(),
});

export const StatusFieldSchema = z.object({
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  fieldType: z.literal('status'),
  value: z.object({
    statusId: z.string().uuid(),
    groupName: z.string(),
  }),
  displayValue: z.string(),
});

export const AnyFieldSchema = z.union([
  TextFieldSchema,
  NumberFieldSchema,
  UserFieldSchema,
  CurrencyFieldSchema,
  BooleanFieldSchema,
  DateFieldSchema,
  SelectFieldSchema,
  StatusFieldSchema,
]);

export const FieldsSchema = z.record(AnyFieldSchema);

export const CycleTimeSchema = z.object({
  resolutionTimeMs: z.number(),
  resolutionTimeFormatted: z.string(),
  isInProgress: z.boolean(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});

export const MatterSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  fields: FieldsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  cycleTime: CycleTimeSchema,
  sla: z.enum(['Met', 'Breached', 'In Progress']).nullable(),
});

export const MattersResponseSchema = z.object({
  data: z.array(MatterSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});
