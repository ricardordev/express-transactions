/**
 * E2E tests for transaction endpoints using supertest with imported Express app.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { prisma } from '../../src/infrastructure/prisma';
import { app } from '../../src/server';

describe('Transactions E2E', () => {
    const credentials = { login: 'test', password: '12345678' };
    let accessToken: string;
    let transactionHash: string;

    beforeAll(async () => {
        let user = await prisma.user.findUnique({ where: { login: credentials.login } });
        if (!user) {
            const hash = bcrypt.hashSync(credentials.password, 10);
            user = await prisma.user.create({
                data: { login: credentials.login, password: hash, name: 'User Test', email: 'test@test.com' },
            });
        }

        // Clean up any stale data from previous test runs
        await prisma.refreshToken.deleteMany({
            where: { userId: user?.id },
        });
        await prisma.userTransactions.deleteMany({
            where: { user_id: user?.id },
        });
        await prisma.transactions.deleteMany({
            where: { id: user.id },
        });

        const res = await request(app)
            .post('/auth/login')
            .send(credentials);

        if (res.status === 200) {
            accessToken = res.body.token;
        }
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('GET /transactions', () => {
        it('should return paginated transactions with valid token', async () => {
            const res = await request(app)
                .get('/transactions')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(res.body.meta).toHaveProperty('totalItems');
            expect(res.body.meta).toHaveProperty('currentPage');
            expect(res.body.meta).toHaveProperty('itemsPerPage');
            expect(res.body.meta).toHaveProperty('totalPages');
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should accept pagination query params', async () => {
            const res = await request(app)
                .get('/transactions?page=1&limit=5')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(res.body.meta.currentPage).toBe(1);
            expect(res.body.meta.itemsPerPage).toBe(5);
        });

        it('should return 401 without token', async () => {
            const res = await request(app)
                .get('/transactions')
                .expect(401);

            expect(res.body).toHaveProperty('error', true);
        });
    });

    describe('POST /transactions', () => {
        it('should create a transaction', async () => {
            const res = await request(app)
                .post('/transactions')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ name: 'E2E Test Transaction', amount: 99.99 })
                .expect(201);

            expect(res.body).toHaveProperty('hash');
            expect(res.body).toHaveProperty('name', 'E2E Test Transaction');
            // Decimal is serialized as string in JSON
            expect(res.body).toHaveProperty('amount', '99.99');

            transactionHash = res.body.hash;
        });

        it('should accept optional created_at', async () => {
            const res = await request(app)
                .post('/transactions')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ name: 'Dated Transaction', amount: 50, created_at: '2026-01-01T00:00:00Z' })
                .expect(201);

            expect(res.body).toHaveProperty('hash');
        });

        it('should return 400 for invalid data', async () => {
            const res = await request(app)
                .post('/transactions')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ name: '', amount: -10 })
                .expect(400);

            expect(res.body).toHaveProperty('error', true);
        });

        it('should return 401 without token', async () => {
            const res = await request(app)
                .post('/transactions')
                .send({ name: 'Unauthorized', amount: 10 })
                .expect(401);

            expect(res.body).toHaveProperty('error', true);
        });
    });

    describe('GET /transactions/:hash', () => {
        it('should return a transaction by hash', async () => {
            const res = await request(app)
                .get(`/transactions/${transactionHash}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('hash', transactionHash);
            expect(res.body).toHaveProperty('name', 'E2E Test Transaction');
        });

        it('should return 404 for non-existent hash', async () => {
            const res = await request(app)
                .get('/transactions/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(404);

            expect(res.body).toHaveProperty('error', true);
        });

        it('should return 400 for invalid hash format', async () => {
            const res = await request(app)
                .get('/transactions/not-a-uuid')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(400);

            expect(res.body).toHaveProperty('error', true);
        });
    });

    describe('PUT /transactions/:hash', () => {
        it('should update a transaction', async () => {
            const res = await request(app)
                .put(`/transactions/${transactionHash}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ name: 'Updated E2E', amount: 150.50 })
                .expect(200);

            expect(res.body).toHaveProperty('name', 'Updated E2E');
            expect(res.body).toHaveProperty('amount', '150.5');
        });

        it('should return 400 for invalid update data', async () => {
            const res = await request(app)
                .put(`/transactions/${transactionHash}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ name: '', amount: 0 })
                .expect(400);

            expect(res.body).toHaveProperty('error', true);
        });
    });

    describe('DELETE /transactions/:hash', () => {
        it('should return the soft-deleted record with deleted_at set', async () => {
            await request(app)
                .delete(`/transactions/${transactionHash}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(204);

            // findByHash doesn't filter deleted_at — record is returned with deleted_at set
            const getRes = await request(app)
                .get(`/transactions/${transactionHash}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(getRes.body).toHaveProperty('deleted_at');
            expect(getRes.body.deleted_at).not.toBeNull();
        });

        it('should return 401 without token', async () => {
            const res = await request(app)
                .delete(`/transactions/${transactionHash}`)
                .expect(401);

            expect(res.body).toHaveProperty('error', true);
        });
    });
});