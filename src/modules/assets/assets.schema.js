import { z } from 'zod';

const PG_INT_MAX = 2147483647;

const parseCommaList = (maxItems, maxItemLength) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxItems * (maxItemLength + 1))
    .transform((val) =>
      val
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .refine(
      (arr) =>
        arr.length >= 1 &&
        arr.length <= maxItems &&
        arr.every((item) => item.length <= maxItemLength),
      {
        message: `Must contain 1 to ${maxItems} items (max ${maxItemLength} chars each)`,
      },
    );

export const searchAssetsSchema = z.object({
  query: z.object({
    query: z.string().trim().min(1).max(100).optional(),
    queries: parseCommaList(20, 100).optional(),
    tickers: parseCommaList(50, 20).optional(),
    type: z.string().trim().min(1).max(10).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).max(PG_INT_MAX).default(0),
  }),
});
