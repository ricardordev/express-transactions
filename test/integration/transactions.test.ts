/**
 * Integration tests for TransactionsService — requires a running test database.
 *
 * Setup: same as auth integration tests — requires DATABASE_URL pointing to a test database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from "../../src/infrastructure/prisma";
import { TransactionsService } from '../../src/transactions/transactions.service';

const SKIP = !process.env.DATABASE_URL?.includes('test');
const describeIf = SKIP ? describe.skip : describe;

describeIf('Transactions Integration', () => {

    beforeAll(async () => {
    });

    afterAll(async () => {
        // Delete userTransactions first to avoid FK violations
        const txs = await prisma.transactions.findMany({ where: { name: { contains: 'integration_test_' } }, select: { id: true } });
        const ids = txs.map(t => t.id);
        if (ids.length > 0) {
            await prisma.userTransactions.deleteMany({ where: { transaction_id: { in: ids } } });
        }
        await prisma.transactions.deleteMany({ where: { name: { contains: 'integration_test_' } } });
        await prisma.$disconnect();
    });

    it('should list transactions paginated', async () => {
        const result = await TransactionsService.list(1, 10);

        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('meta');
        expect(result.meta).toHaveProperty('totalItems');
        expect(result.meta).toHaveProperty('currentPage');
        expect(result.meta).toHaveProperty('itemsPerPage');
        expect(result.meta).toHaveProperty('totalPages');
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.meta.currentPage).toBe(1);
    });

    it('should create and find a transaction', async () => {
        const created = await TransactionsService.create({
            name: 'integration_test_create',
            amount: 42.50,
        });

        expect(created).toHaveProperty('hash');
        expect(created.name).toBe('integration_test_create');
        expect(Number(created.amount)).toBe(42.50);
        expect(created.hash).toBeTruthy();

        const found = await TransactionsService.findByHash(created.hash!);
        expect(found).not.toBeNull();
        expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent hash', async () => {
        const result = await TransactionsService.findByHash('00000000-0000-0000-0000-000000000000');
        expect(result).toBeNull();
    });

    it('should update a transaction', async () => {
        const created = await TransactionsService.create({
            name: 'integration_test_update',
            amount: 10,
        });

        const updated = await TransactionsService.update(created.hash!, {
            name: 'integration_test_updated',
            amount: 99,
        });

        expect(updated.name).toBe('integration_test_updated');
        expect(Number(updated.amount)).toBe(99);
    });

    it('should soft delete a transaction (owner match)', async () => {
        const created = await TransactionsService.create({
            name: 'integration_test_soft_delete',
            amount: 5,
        });

        // softDelete checks created_by, so we pass the owner's userId directly
        // Since no userId was passed to create, created_by is null, but softDelete
        // validates the hash matches — use a synthetic userId for the delete check
        const deleted = await TransactionsService.softDelete(created.hash!, 0);
        expect(deleted).toBe(false); // not the owner (created_by is null)

        // Create one with a userId from a real user
        const userResult = await prisma.user.findFirst({ where: { login: 'rotation_test_user' } });
        if (userResult) {
            const ownedTx = await TransactionsService.create({
                name: 'integration_test_owned_delete',
                amount: 5,
                userId: userResult.id,
            });
            const ownedDeleted = await TransactionsService.softDelete(ownedTx.hash!, userResult.id);
            expect(ownedDeleted).toBe(true);

            // findByHash doesn't filter deleted_at — verify it's soft-deleted
            const foundOwned = await TransactionsService.findByHash(ownedTx.hash!);
            expect(foundOwned).not.toBeNull();
            expect(foundOwned!.deleted_at).not.toBeNull();

            // Non-owner should not be able to delete
            const notOwnerDelete = await TransactionsService.softDelete(ownedTx.hash!, 999999);
            expect(notOwnerDelete).toBe(false);
        }
    });

    it('should handle pagination across multiple pages', async () => {
        // Create 5 transactions
        for (let i = 0; i < 5; i++) {
            await TransactionsService.create({
                name: `integration_test_page_${i}`,
                amount: i + 1,
            });
        }

        const page1 = await TransactionsService.list(1, 2);
        expect(page1.data.length).toBeLessThanOrEqual(2);

        const page2 = await TransactionsService.list(2, 2);
        expect(page2.data.length).toBeLessThanOrEqual(2);
    });
});