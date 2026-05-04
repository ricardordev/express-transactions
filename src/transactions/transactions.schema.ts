import { z } from "zod";

export const createTransactionSchema = z.object({
    name: z.string().trim().min(1).max(199),
    amount: z.number().positive(),
    created_at: z.string().datetime().optional(),
}).strict();

export const updateTransactionSchema = z.object({
    name: z.string().trim().min(1).max(199),
    amount: z.number().positive(),
}).strict();

export const getTransactionParamsSchema = z.object({
    hash: z.string().uuid(),
});

export const deleteTransactionParamsSchema = z.object({
    hash: z.string().uuid(),
});

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});