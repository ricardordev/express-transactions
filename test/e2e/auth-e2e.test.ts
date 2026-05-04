/**
 * E2E tests for auth endpoints using supertest with imported Express app.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { prisma } from '../../src/infrastructure/prisma';
import { app } from '../../src/server';

describe('Auth E2E', () => {
    const credentials = { login: 'test', password: '12345678' };

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
            where: { id: user?.id },
        });
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    let accessToken: string;
    let refreshToken: string;
    let lookupKey: string;

    describe('POST /auth/login', () => {
        it('should login and return token pair with cookies', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send(credentials)
                .expect(200);

            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('refresh_token');
            expect(res.body).toHaveProperty('lookup_key');
            expect(res.body).toHaveProperty('type', 'Bearer');
            expect(res.body).toHaveProperty('expires_in');

            accessToken = res.body.token;
            refreshToken = res.body.refresh_token;
            lookupKey = res.body.lookup_key;

            // Verify cookies are set
            const cookies = res.headers['set-cookie'] as unknown as string[];
            expect(cookies).toBeDefined();
            expect(cookies.some((c: string) => c.startsWith('access_token='))).toBe(true);
            expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
        });

        it('should return 400 for missing fields', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({ login: 'test' })
                .expect(400);

            expect(res.body).toHaveProperty('error', true);
        });

        it('should return 401 for invalid credentials', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({ login: 'test', password: 'wrong' })
                .expect(401);

            expect(res.body).toHaveProperty('message', 'Invalid credentials.');
        });
    });

    describe('GET /auth/me', () => {
        it('should return user profile with valid token', async () => {
            const res = await request(app)
                .get('/auth/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('login', 'test');
            expect(res.body).toHaveProperty('name');
            expect(res.body).toHaveProperty('email');
        });

        it('should return 401 without token', async () => {
            await request(app)
                .get('/auth/me')
                .expect(401);
        });

        it('should return 401 with invalid token', async () => {
            const res = await request(app)
                .get('/auth/me')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(res.body).toHaveProperty('error', true);
        });
    });

    describe('POST /auth/refresh', () => {
        it('should return new token pair', async () => {
            // Wait to ensure JWT gets a different iat (seconds precision)
            await new Promise(r => setTimeout(r, 1100));
            const res = await request(app)
                .post('/auth/refresh')
                .send({ refresh_token: refreshToken, lookup_key: lookupKey })
                .expect(200);

            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('refresh_token');
            expect(res.body).toHaveProperty('lookup_key');

            // Tokens should be different
            expect(res.body.token).not.toBe(accessToken);
            expect(res.body.refresh_token).not.toBe(refreshToken);

            accessToken = res.body.token;
            refreshToken = res.body.refresh_token;
            lookupKey = res.body.lookup_key;
        });

        it('should return 400 for missing lookup_key', async () => {
            const res = await request(app)
                .post('/auth/refresh')
                .send({ refresh_token: 'some-token' })
                .expect(400);

            expect(res.body).toHaveProperty('error', true);
        });

        it('should detect token reuse and return 401', async () => {
            // Login fresh to get a clean token family
            const loginRes = await request(app)
                .post('/auth/login')
                .send(credentials)
                .expect(200);

            const freshRt = loginRes.body.refresh_token;
            const freshLk = loginRes.body.lookup_key;

            // Refresh once to rotate
            const res1 = await request(app)
                .post('/auth/refresh')
                .send({ refresh_token: freshRt, lookup_key: freshLk })
                .expect(200);

            // Reuse the SAME token — should detect reuse
            const res = await request(app)
                .post('/auth/refresh')
                .send({ refresh_token: freshRt, lookup_key: freshLk })
                .expect(401);

            expect(res.body).toHaveProperty('message', 'Token reuse detected.');
        });
    });

    describe('POST /auth/logout', () => {
        it('should logout and return 204', async () => {
            const loginRes = await request(app)
                .post('/auth/login')
                .send(credentials)
                .expect(200);

            const res = await request(app)
                .post('/auth/logout')
                .set('Authorization', `Bearer ${loginRes.body.token}`)
                .send({ refresh_token: loginRes.body.refresh_token })
                .expect(204);

            // ClearCookie headers should be set
            const cookies = res.headers['set-cookie'];
            expect(cookies).toBeDefined();
        });

        it('should return 401 without authentication', async () => {
            await request(app)
                .post('/auth/logout')
                .expect(401);
        });
    });
});