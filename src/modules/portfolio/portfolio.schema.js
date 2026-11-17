import { z } from 'zod';

const PG_INT_MAX = 2147483647;

export const getPortfolioSchema = z.object({
  params: z.object({
    userId: z.coerce.number().int().positive().max(PG_INT_MAX),
  }),
});
