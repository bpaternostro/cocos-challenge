import { z } from 'zod';

const PG_INT_MAX = 2147483647;
const MAX_ORDER_TOTAL = 9999999999999;

export const createOrderSchema = z.object({
  headers: z
    .object({
      'idempotency-key': z.string().uuid('Idempotency-Key must be a valid UUID').optional(),
    })
    .passthrough(),
  body: z
    .object({
      userId: z.number().int().positive().max(PG_INT_MAX),
      instrumentId: z.number().int().positive().max(PG_INT_MAX),
      side: z.enum(['BUY', 'SELL', 'CASH_IN', 'CASH_OUT']),
      type: z.enum(['MARKET', 'LIMIT']).default('MARKET'),
      size: z.number().int().positive().max(PG_INT_MAX).optional(),
      amount: z.number().positive().max(MAX_ORDER_TOTAL).optional(),
      price: z.number().positive().max(99999999.99, 'price exceeds maximum allowed value (99999999.99)').optional(),
    })
    .superRefine((data, ctx) => {
      const hasSize = data.size !== undefined;
      const hasAmount = data.amount !== undefined;

      if (hasSize === hasAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide either size or amount, but not both',
          path: ['size'],
        });
      }

      if ((data.side === 'CASH_IN' || data.side === 'CASH_OUT') && data.type !== 'MARKET') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CASH_IN and CASH_OUT orders must have type MARKET',
          path: ['type'],
        });
      }

      if (data.type === 'LIMIT' && data.price === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'price is required for LIMIT orders',
          path: ['price'],
        });
      }

      if (data.type === 'MARKET' && data.price !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'price must not be provided for MARKET orders',
          path: ['price'],
        });
      }

      if (data.size !== undefined && data.price !== undefined && data.size * data.price > MAX_ORDER_TOTAL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Order total exceeds maximum supported amount',
          path: ['size'],
        });
      }
    }),
});

export const cancelOrderSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive().max(PG_INT_MAX),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive().max(PG_INT_MAX),
  }),
  body: z.object({
    status: z.enum(['FILLED', 'CANCELLED', 'REJECTED']),
  }),
});

export const listOrdersSchema = z.object({
  query: z.object({
    userId: z.coerce.number().int().positive().max(PG_INT_MAX),
    status: z.enum(['NEW', 'FILLED', 'REJECTED', 'CANCELLED']).optional(),
    side: z.enum(['BUY', 'SELL', 'CASH_IN', 'CASH_OUT']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).max(PG_INT_MAX).default(0),
  }),
});
