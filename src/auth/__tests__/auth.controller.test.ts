import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../infrastructure/prisma', () => ({
    prisma: {
        user: { findUnique: vi.fn() },
        refreshToken: { create: vi.fn() },
    },
}));

import { AuthController } from '../auth.controller';
import { AuthService, AuthError } from '../auth.service';

describe('AuthController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;
    let statusJson: any;

    beforeEach(() => {
        vi.clearAllMocks();
        statusJson = {};
        req = {
            body: {},
            cookies: {},
            user: undefined,
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockImplementation((obj) => { statusJson = obj; return res; }),
            cookie: vi.fn().mockReturnThis(),
            clearCookie: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        };
        next = vi.fn();
        process.env.JWT_SECRET = 'test-secret';
        process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    });

    describe('login', () => {
        it('should return 200 with token pair on successful login', async () => {
            const mockPair = {
                access_token: 'access-token',
                refresh_token: 'refresh-token',
                lookup_key: 'lookup-key',
                expires_in: '15m',
            };
            vi.spyOn(AuthService, 'login').mockResolvedValue(mockPair);

            req.body = { login: 'test', password: '12345678' };
            await AuthController.login(req as Request, res as Response, next);

            expect(AuthService.login).toHaveBeenCalledWith('test', '12345678');
            expect(res.cookie).toHaveBeenCalledTimes(2);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(statusJson).toHaveProperty('token', 'access-token');
        });

        it('should return 401 on invalid credentials', async () => {
            vi.spyOn(AuthService, 'login').mockRejectedValue(new AuthError('Invalid credentials.', 401));

            req.body = { login: 'test', password: 'wrong' };
            await AuthController.login(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(statusJson).toHaveProperty('message', 'Invalid credentials.');
        });

        it('should call next for unexpected errors', async () => {
            vi.spyOn(AuthService, 'login').mockRejectedValue(new Error('Unexpected'));

            req.body = { login: 'test', password: 'pass' };
            await AuthController.login(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('refresh', () => {
        it('should return 200 with new token pair', async () => {
            const mockPair = {
                access_token: 'new-access',
                refresh_token: 'new-refresh',
                lookup_key: 'new-lookup',
                expires_in: '15m',
            };
            vi.spyOn(AuthService, 'refresh').mockResolvedValue(mockPair);

            req.body = { refresh_token: 'old-rt', lookup_key: 'lk' };
            await AuthController.refresh(req as Request, res as Response, next);

            expect(AuthService.refresh).toHaveBeenCalledWith('old-rt', 'lk');
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should return 400 if refresh_token or lookup_key missing', async () => {
            await AuthController.refresh(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(statusJson).toHaveProperty('message', 'refresh_token and lookup_key required.');
        });

        it('should clear cookies on token reuse', async () => {
            vi.spyOn(AuthService, 'refresh').mockRejectedValue(new AuthError('Token reuse detected.', 401));

            req.body = { refresh_token: 'rt', lookup_key: 'lk' };
            await AuthController.refresh(req as Request, res as Response, next);

            expect(res.clearCookie).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should read refresh_token from cookie if not in body', async () => {
            vi.spyOn(AuthService, 'refresh').mockResolvedValue({
                access_token: 'at', refresh_token: 'rt', lookup_key: 'lk', expires_in: '15m',
            });

            req.cookies = { refresh_token: 'cookie-rt' };
            req.body = { refresh_token: undefined, lookup_key: 'lk' };
            await AuthController.refresh(req as Request, res as Response, next);

            expect(AuthService.refresh).toHaveBeenCalledWith('cookie-rt', 'lk');
        });
    });

    describe('logout', () => {
        it('should return 204 on successful logout', async () => {
            vi.spyOn(AuthService, 'logout').mockResolvedValue();
            req.user = { id: 1 };
            req.body = { refresh_token: 'rt' };

            await AuthController.logout(req as Request, res as Response, next);

            expect(res.clearCookie).toHaveBeenCalledTimes(2);
            expect(res.status).toHaveBeenCalledWith(204);
        });

        it('should return 401 if user not authenticated', async () => {
            await AuthController.logout(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should still clear cookies even without refreshToken', async () => {
            req.user = { id: 1 };
            await AuthController.logout(req as Request, res as Response, next);

            expect(res.clearCookie).toHaveBeenCalledTimes(2);
            expect(res.status).toHaveBeenCalledWith(204);
        });
    });

    describe('me', () => {
        it('should return 200 with user profile', async () => {
            const profile = { id: 1, login: 'test', name: 'Test', email: 'test@test.com', created_at: new Date() };
            vi.spyOn(AuthService, 'getUserProfile').mockResolvedValue(profile);
            req.user = { id: 1 };

            await AuthController.me(req as Request, res as Response, next);

            expect(AuthService.getUserProfile).toHaveBeenCalledWith(1);
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should return 401 if not authenticated', async () => {
            await AuthController.me(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 404 if user not found', async () => {
            vi.spyOn(AuthService, 'getUserProfile').mockRejectedValue(new AuthError('User not found.', 404));
            req.user = { id: 999 };

            await AuthController.me(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });
});