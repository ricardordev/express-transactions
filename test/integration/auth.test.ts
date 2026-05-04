/**
 * Integration tests for AuthService — requires a running test database.
 *
 * Setup:
 * 1. Create a .env.test with DATABASE_URL pointing to a test database
 * 2. Run: npx prisma db push --schema=prisma/schema.prisma
 * 3. Create a test user via SQL (see README "Create a User" section)
 *
 * Required env vars: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import { prisma } from "../../src/infrastructure/prisma";
import { AuthService, AuthError } from '../../src/auth/auth.service';

const describeIf = !process.env.DATABASE_URL?.includes('test') && !process.env.RUN_E2E ? describe.skip : describe;

describeIf('Auth Integration', () => {
    let testUserId: number;
    let pair: Awaited<ReturnType<typeof AuthService.login>>;
    const TEST_USER = 'integration_test_user';
    const TEST_PASS = 'Test@12345';

    beforeAll(async () => {
        // Create test user
        const hash = bcrypt.hashSync(TEST_PASS, 10);
        const user = await prisma.user.upsert({
            where: { login: TEST_USER },
            update: { password: hash },
            create: { login: TEST_USER, password: hash, name: 'Integration Test', email: 'integration@test.com' },
        });
        testUserId = user.id;
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
        process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'integration-test-refresh-secret';
    });

    afterAll(async () => {
        // Cleanup
        await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => { });
        await prisma.$disconnect();
    });

    it('should login and return token pair', async () => {
        pair = await AuthService.login(TEST_USER, TEST_PASS);

        expect(pair).toHaveProperty('access_token');
        expect(pair).toHaveProperty('refresh_token');
        expect(pair).toHaveProperty('lookup_key');
        expect(pair).toHaveProperty('expires_in');
        expect(pair.access_token).toBeTruthy();
        expect(pair.refresh_token).toBeTruthy();
    });

    it('should reject invalid password', async () => {
        await expect(AuthService.login(TEST_USER, 'WRONG_PASSWORD')).rejects.toThrow(AuthError);
    });

    it('should refresh tokens successfully', async () => {
        // Wait to ensure the JWT gets a different iat (seconds precision)
        await new Promise(r => setTimeout(r, 1100));
        const newPair = await AuthService.refresh(pair.refresh_token, pair.lookup_key);

        expect(newPair.access_token).toBeTruthy();
        expect(newPair.refresh_token).toBeTruthy();
        expect(newPair.access_token).not.toBe(pair.access_token);
        expect(newPair.refresh_token).not.toBe(pair.refresh_token);

        pair = newPair;
    });

    it('should detect token reuse and revoke family', async () => {
        const oldRefreshToken = pair.refresh_token;
        const lookupKey = pair.lookup_key;

        // Refresh once to rotate
        const firstRefresh = await AuthService.refresh(oldRefreshToken, lookupKey);

        // Try to reuse old token — should detect reuse
        await expect(AuthService.refresh(oldRefreshToken, lookupKey)).rejects.toThrow(AuthError);

        // The new token from the first refresh should also be revoked
        await expect(AuthService.refresh(firstRefresh.refresh_token, firstRefresh.lookup_key)).rejects.toThrow(AuthError);
    });

    it('should logout successfully', async () => {
        // Login fresh since previous test revoked everything
        const freshPair = await AuthService.login(TEST_USER, TEST_PASS);

        await AuthService.logout(testUserId, freshPair.refresh_token);

        // After logout, refresh should fail
        await expect(AuthService.refresh(freshPair.refresh_token, freshPair.lookup_key)).rejects.toThrow(AuthError);
    });

    it('should getUserProfile return correct data', async () => {
        const profile = await AuthService.getUserProfile(testUserId);

        expect(profile.id).toBe(testUserId);
        expect(profile.login).toBe(TEST_USER);
        expect(profile.email).toBe('integration@test.com');
    });

    it('should throw 404 for non-existent user profile', async () => {
        await expect(AuthService.getUserProfile(999999)).rejects.toThrow(AuthError);
    });
});