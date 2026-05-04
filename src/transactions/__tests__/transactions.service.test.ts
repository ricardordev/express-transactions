import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../infrastructure/prisma', () => ({
    prisma: {
        transactions: {
            findMany: vi.fn(),
            count: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        userTransactions: {
            create: vi.fn(),
        },
    },
}));

import { prisma } from '../../infrastructure/prisma';
import { TransactionsService } from '../transactions.service';

describe('TransactionsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('list', () => {
        it('should return paginated transactions', async () => {
            const mockTransactions = [{ id: 1, name: 'Tx 1', amount: 100 }];
            (prisma.transactions.findMany as any).mockResolvedValue(mockTransactions);
            (prisma.transactions.count as any).mockResolvedValue(1);

            const result = await TransactionsService.list(1, 10);

            expect(result.data).toEqual(mockTransactions);
            expect(result.meta).toEqual({
                totalItems: 1,
                currentPage: 1,
                itemsPerPage: 10,
                totalPages: 1,
            });
        });

        it('should calculate skip correctly for page > 1', async () => {
            (prisma.transactions.findMany as any).mockResolvedValue([]);
            (prisma.transactions.count as any).mockResolvedValue(100);

            await TransactionsService.list(3, 10);

            expect(prisma.transactions.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ skip: 20, take: 10 })
            );
        });

        it('should filter out soft-deleted records', async () => {
            (prisma.transactions.findMany as any).mockResolvedValue([]);
            (prisma.transactions.count as any).mockResolvedValue(0);

            await TransactionsService.list(1, 10);

            expect(prisma.transactions.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { deleted_at: null } })
            );
        });

        it('should calculate totalPages correctly with remainders', async () => {
            (prisma.transactions.findMany as any).mockResolvedValue([]);
            (prisma.transactions.count as any).mockResolvedValue(25);

            const result = await TransactionsService.list(1, 10);
            expect(result.meta.totalPages).toBe(3);
        });
    });

    describe('findByHash', () => {
        it('should return a transaction by hash', async () => {
            const tx = { id: 1, hash: 'abc', name: 'Test' };
            (prisma.transactions.findUnique as any).mockResolvedValue(tx);

            const result = await TransactionsService.findByHash('abc');
            expect(result).toEqual(tx);
        });

        it('should return null if not found', async () => {
            (prisma.transactions.findUnique as any).mockResolvedValue(null);

            const result = await TransactionsService.findByHash('not-found');
            expect(result).toBeNull();
        });
    });

    describe('create', () => {
        it('should create a transaction and return it', async () => {
            const created = { id: 1, name: 'New Tx', amount: 50, hash: 'hash-1' };
            (prisma.transactions.create as any).mockResolvedValue(created);

            const result = await TransactionsService.create({ name: 'New Tx', amount: 50 });

            expect(result).toEqual(created);
            expect(prisma.transactions.create).toHaveBeenCalled();
        });

        it('should create userTransaction if userId provided', async () => {
            (prisma.transactions.create as any).mockResolvedValue({ id: 1 });
            (prisma.userTransactions.create as any).mockResolvedValue({});

            await TransactionsService.create({ name: 'Tx', amount: 10, userId: 5 });

            expect(prisma.userTransactions.create).toHaveBeenCalledWith({
                data: { user_id: 5, transaction_id: 1 },
            });
        });

        it('should trim the name', async () => {
            (prisma.transactions.create as any).mockResolvedValue({ id: 1 });

            await TransactionsService.create({ name: '  spaced  ', amount: 10 });

            expect(prisma.transactions.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ name: 'spaced' }) })
            );
        });
    });

    describe('update', () => {
        it('should update a transaction', async () => {
            const updated = { id: 1, name: 'Updated', amount: 200 };
            (prisma.transactions.update as any).mockResolvedValue(updated);

            const result = await TransactionsService.update('hash', { name: 'Updated', amount: 200 });

            expect(result).toEqual(updated);
        });
    });

    describe('softDelete', () => {
        it('should return true when a record was deleted', async () => {
            (prisma.transactions.updateMany as any).mockResolvedValue({ count: 1 });

            const result = await TransactionsService.softDelete('hash', 5);

            expect(result).toBe(true);
            expect(prisma.transactions.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { hash: 'hash', created_by: 5, deleted_at: null },
                })
            );
        });

        it('should return false when no matching record found', async () => {
            (prisma.transactions.updateMany as any).mockResolvedValue({ count: 0 });

            const result = await TransactionsService.softDelete('hash', 99);

            expect(result).toBe(false);
        });
    });
});