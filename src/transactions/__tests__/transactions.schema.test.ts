import { describe, it, expect } from 'vitest';
import {
    createTransactionSchema,
    updateTransactionSchema,
    getTransactionParamsSchema,
    deleteTransactionParamsSchema,
    paginationQuerySchema,
} from '../transactions.schema';

describe('Transaction Schemas', () => {
    describe('createTransactionSchema', () => {
        it('should accept valid transaction data', () => {
            const result = createTransactionSchema.safeParse({ name: 'Test', amount: 100 });
            expect(result.success).toBe(true);
        });

        it('should accept optional created_at', () => {
            const result = createTransactionSchema.safeParse({
                name: 'Test', amount: 100, created_at: '2026-01-01T00:00:00Z',
            });
            expect(result.success).toBe(true);
        });

        it('should reject negative amount', () => {
            const result = createTransactionSchema.safeParse({ name: 'Test', amount: -10 });
            expect(result.success).toBe(false);
        });

        it('should reject empty name', () => {
            const result = createTransactionSchema.safeParse({ name: '', amount: 100 });
            expect(result.success).toBe(false);
        });

        it('should reject extra fields (strict)', () => {
            const result = createTransactionSchema.safeParse({ name: 'Test', amount: 100, extra: true });
            expect(result.success).toBe(false);
        });
    });

    describe('updateTransactionSchema', () => {
        it('should accept valid update data', () => {
            const result = updateTransactionSchema.safeParse({ name: 'Updated', amount: 200 });
            expect(result.success).toBe(true);
        });

        it('should reject zero amount', () => {
            const result = updateTransactionSchema.safeParse({ name: 'Test', amount: 0 });
            expect(result.success).toBe(false);
        });
    });

    describe('getTransactionParamsSchema', () => {
        it('should accept valid UUID hash', () => {
            const result = getTransactionParamsSchema.safeParse({ hash: '550e8400-e29b-41d4-a716-446655440000' });
            expect(result.success).toBe(true);
        });

        it('should reject invalid hash', () => {
            const result = getTransactionParamsSchema.safeParse({ hash: 'not-a-uuid' });
            expect(result.success).toBe(false);
        });
    });

    describe('deleteTransactionParamsSchema', () => {
        it('should accept valid UUID hash', () => {
            const result = deleteTransactionParamsSchema.safeParse({ hash: '550e8400-e29b-41d4-a716-446655440000' });
            expect(result.success).toBe(true);
        });
    });

    describe('paginationQuerySchema', () => {
        it('should coerce string to number and apply defaults', () => {
            const result = paginationQuerySchema.parse({ page: '1', limit: '10' });
            expect(result).toEqual({ page: 1, limit: 10 });
        });

        it('should apply defaults when no query provided', () => {
            const result = paginationQuerySchema.parse({});
            expect(result).toEqual({ page: 1, limit: 10 });
        });

        it('should reject page < 1', () => {
            const result = paginationQuerySchema.safeParse({ page: '0' });
            expect(result.success).toBe(false);
        });

        it('should reject limit > 100', () => {
            const result = paginationQuerySchema.safeParse({ limit: '101' });
            expect(result.success).toBe(false);
        });
    });
});