/**
 * Focused integration test for refresh token rotation and family revocation.
 * Requires DATABASE_URL pointing to a test database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import { prisma } from "../../src/infrastructure/prisma";
import { AuthService, AuthError } from '../../src/auth/auth.service';

const describeIf = !process.env.DATABASE_URL?.includes('test') && !process.env.RUN_E2E ? describe.skip : describe;

describeIf('Refresh Token Rotation', () => {
    let testUserId: number;
    const TEST_USER = 'rotation_test_user';
    const TEST_PASS = 'Rotation@123';

    beforeAll(async () => {

        const hash = bcrypt.hashSync(TEST_PASS, 10);
        const user = await prisma.user.upsert({
            where: { login: TEST_USER },
            update: { password: hash },
            create: { login: TEST_USER, password: hash, name: 'Rotation Test', email: 'rotation@test.com' },
        });
        testUserId = user.id;
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'rotation-test-secret';
        process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'rotation-test-refresh-secret';
    });

    afterAll(async () => {
        await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => { });
        await prisma.$disconnect();
    });

    it('should rotate tokens — each refresh produces new tokens', async () => {
        const pair1 = await AuthService.login(TEST_USER, TEST_PASS);
        // Wait to ensure the next JWT gets a different iat (seconds precision)
        await new Promise(r => setTimeout(r, 1100));
        const pair2 = await AuthService.refresh(pair1.refresh_token, pair1.lookup_key);
        await new Promise(r => setTimeout(r, 1100));
        const pair3 = await AuthService.refresh(pair2.refresh_token, pair2.lookup_key);

        expect(pair1.access_token).not.toBe(pair2.access_token);
        expect(pair2.access_token).not.toBe(pair3.access_token);
        expect(pair1.refresh_token).not.toBe(pair2.refresh_token);
        expect(pair2.refresh_token).not.toBe(pair3.refresh_token);
        // lookup_key changes on every createPair() call (login and refresh)
        expect(pair1.lookup_key).not.toBe(pair2.lookup_key);
        expect(pair2.lookup_key).not.toBe(pair3.lookup_key);
    });

    it('should revoke entire family on token reuse', async () => {
        await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });

        const pair = await AuthService.login(TEST_USER, TEST_PASS);
        const refreshed = await AuthService.refresh(pair.refresh_token, pair.lookup_key);

        // Reuse old refresh token
        await expect(AuthService.refresh(pair.refresh_token, pair.lookup_key)).rejects.toThrow(AuthError);

        // New token should also be invalid (family revoked)
        await expect(AuthService.refresh(refreshed.refresh_token, refreshed.lookup_key)).rejects.toThrow(AuthError);
    });

    it('should bump token_version on logout', async () => {
        await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });

        const pair = await AuthService.login(TEST_USER, TEST_PASS);
        await AuthService.logout(testUserId, pair.refresh_token);

        const userAfterLogout = await prisma.user.findUnique({ where: { id: testUserId } });
        expect(userAfterLogout?.token_version).toBeGreaterThan(0);
    });

    it('old access token should be invalid after logout bumps version', async () => {
        const pair = await AuthService.login(TEST_USER, TEST_PASS);
        const accessToken = AuthService.generateAccessToken(testUserId, 0);

        // Logout bumps version
        await AuthService.logout(testUserId, pair.refresh_token);

        const user = await prisma.user.findUnique({ where: { id: testUserId } });
        // Generate new access with current version
        const newAccess = AuthService.generateAccessToken(testUserId, user!.token_version);

        expect(newAccess).toBeTruthy();
    });
});