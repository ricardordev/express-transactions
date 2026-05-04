import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('jsonwebtoken');
vi.mock('../../infrastructure/prisma', () => ({
    prisma: {
        user: { findUnique: vi.fn() },
    },
}));

import jwt from 'jsonwebtoken';
import { prisma } from '../../infrastructure/prisma';
import { authenticate } from '../authenticate';

describe('authenticate middleware', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;
    let statusJson: any;

    beforeEach(() => {
        vi.clearAllMocks();
        statusJson = {};
        req = {
            headers: {},
            cookies: {},
            user: undefined,
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockImplementation((obj) => { statusJson = obj; return res; }),
        };
        next = vi.fn();
        process.env.JWT_SECRET = 'test-secret';
        process.env.NODE_ENV = 'development';
    });

    describe('missing JWT_SECRET', () => {
        it('should bypass auth in development when JWT_SECRET is empty', async () => {
            delete process.env.JWT_SECRET;
            await authenticate(req as Request, res as Response, next);
            expect(next).toHaveBeenCalled();
        });

        it('should return 500 in production when JWT_SECRET is empty', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.JWT_SECRET;

            await authenticate(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('missing token', () => {
        it('should return 401 when no token provided', async () => {
            await authenticate(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(statusJson).toHaveProperty('message', expect.stringContaining('JWT Token missing'));
        });
    });

    describe('valid token', () => {
        it('should set req.user and call next when token is valid', async () => {
            (jwt.verify as any).mockReturnValue({ id: 1, v: 0 });
            (prisma.user.findUnique as any).mockResolvedValue({ token_version: 0 });
            req.headers = { authorization: 'Bearer valid-token' };

            await authenticate(req as Request, res as Response, next);

            expect(req.user).toEqual({ id: 1 });
            expect(next).toHaveBeenCalled();
        });

        it('should read token from cookie if no Authorization header', async () => {
            (jwt.verify as any).mockReturnValue({ id: 2, v: 0 });
            (prisma.user.findUnique as any).mockResolvedValue({ token_version: 0 });
            req.cookies = { access_token: 'cookie-token' };

            await authenticate(req as Request, res as Response, next);

            expect(req.user).toEqual({ id: 2 });
            expect(next).toHaveBeenCalled();
        });
    });

    describe('revoked session', () => {
        it('should return 401 when token version mismatches (optional chain)', async () => {
            (jwt.verify as any).mockReturnValue({ id: 1, v: 2 });
            (prisma.user.findUnique as any).mockResolvedValue({ token_version: 5 });

            req.headers = { authorization: 'Bearer valid-token' };
            await authenticate(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(statusJson).toHaveProperty('message', 'Session revoked. Please log in again.');
        });

        it('should return 401 when user not found (optional chain)', async () => {
            (jwt.verify as any).mockReturnValue({ id: 999, v: 0 });
            (prisma.user.findUnique as any).mockResolvedValue(null);

            req.headers = { authorization: 'Bearer valid-token' };
            await authenticate(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(statusJson).toHaveProperty('message', 'Session revoked. Please log in again.');
        });
    });

    describe('invalid/expired token', () => {
        it('should return 401 for invalid token', async () => {
            (jwt.verify as any).mockImplementation(() => { throw new Error('invalid'); });
            req.headers = { authorization: 'Bearer bad-token' };

            await authenticate(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(statusJson).toHaveProperty('message', 'JWT Token invalid or expired.');
        });
    });
});