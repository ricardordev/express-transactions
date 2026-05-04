import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('bcrypt', () => ({
    default: {
        compareSync: vi.fn(),
    },
}));

vi.mock('jsonwebtoken', () => ({
    default: {
        sign: vi.fn(() => 'mock.jwt.token'),
        verify: vi.fn(),
    },
}));

vi.mock('../../infrastructure/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        refreshToken: {
            create: vi.fn(),
            findMany: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
    },
}));

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../infrastructure/prisma';
import { AuthService, AuthError } from '../auth.service';

describe('AuthService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
        process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
        process.env.JWT_ACCESS_EXPIRES_IN = '15m';
        process.env.JWT_REFRESH_EXPIRES_IN = '7d';
        process.env.NODE_ENV = 'development';
    });

    describe('generateAccessToken', () => {
        it('should generate an access token with userId and tokenVersion', () => {
            AuthService.generateAccessToken(1, 0);
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 1, v: 0 },
                'test-secret',
                { expiresIn: '15m' }
            );
        });

        it('should throw if JWT_SECRET is not configured', () => {
            delete process.env.JWT_SECRET;
            expect(() => AuthService.generateAccessToken(1)).toThrow('JWT_SECRET not configured.');
        });

        it('should default tokenVersion to 0', () => {
            AuthService.generateAccessToken(42);
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 42, v: 0 },
                'test-secret',
                { expiresIn: '15m' }
            );
        });
    });

    describe('hash', () => {
        it('should produce a 64-character hex string', () => {
            // Access private method via prototype
            const result = (AuthService as any).hash('test-token');
            expect(result).toHaveLength(64);
            expect(/^[a-f0-9]+$/.test(result)).toBe(true);
        });

        it('should produce consistent results', () => {
            const a = (AuthService as any).hash('same-input');
            const b = (AuthService as any).hash('same-input');
            expect(a).toBe(b);
        });

        it('should produce different results for different inputs', () => {
            const a = (AuthService as any).hash('input-a');
            const b = (AuthService as any).hash('input-b');
            expect(a).not.toBe(b);
        });
    });

    describe('parseDuration', () => {
        it('should parse seconds', () => {
            expect((AuthService as any).parseDuration('30s')).toBe(30000);
        });

        it('should parse minutes', () => {
            expect((AuthService as any).parseDuration('15m')).toBe(900000);
        });

        it('should parse hours', () => {
            expect((AuthService as any).parseDuration('2h')).toBe(7200000);
        });

        it('should parse days', () => {
            expect((AuthService as any).parseDuration('7d')).toBe(604800000);
        });

        it('should return default (7 days in ms) for invalid format', () => {
            expect((AuthService as any).parseDuration('invalid')).toBe(604800000);
        });
    });

    describe('login', () => {
        it('should throw AuthError for non-existent user', async () => {
            (prisma.user.findUnique as any).mockResolvedValue(null);
            await expect(AuthService.login('nobody', 'pass')).rejects.toThrow(AuthError);
        });

        it('should throw AuthError for wrong password', async () => {
            (prisma.user.findUnique as any).mockResolvedValue({ id: 1, login: 'test', password: 'hash' });
            (bcrypt.compareSync as any).mockReturnValue(false);
            await expect(AuthService.login('test', 'wrong')).rejects.toThrow('Invalid credentials.');
        });

        it('should return a token pair on successful login', async () => {
            (prisma.user.findUnique as any)
                .mockResolvedValueOnce({ id: 1, login: 'test', password: 'hash' })
                .mockResolvedValueOnce({ token_version: 0 });
            (bcrypt.compareSync as any).mockReturnValue(true);
            (prisma.refreshToken.create as any).mockResolvedValue({});

            const pair = await AuthService.login('test', 'correct');
            expect(pair).toHaveProperty('access_token');
            expect(pair).toHaveProperty('refresh_token');
            expect(pair).toHaveProperty('lookup_key');
            expect(pair).toHaveProperty('expires_in');
        });
    });

    describe('getAccessTokenCookieOptions', () => {
        it('should return secure: false in development', () => {
            const opts = AuthService.getAccessTokenCookieOptions();
            expect(opts.httpOnly).toBe(true);
            expect(opts.secure).toBe(false);
        });

        it('should return secure: true in production', () => {
            process.env.NODE_ENV = 'production';
            const opts = AuthService.getAccessTokenCookieOptions();
            expect(opts.secure).toBe(true);
        });
    });

    describe('getRefreshTokenCookieOptions', () => {
        it('should set path to /auth', () => {
            const opts = AuthService.getRefreshTokenCookieOptions();
            expect(opts.path).toBe('/auth');
        });
    });

    describe('accessCookieName / refreshCookieName', () => {
        it('should return correct cookie names', () => {
            expect(AuthService.accessCookieName).toBe('access_token');
            expect(AuthService.refreshCookieName).toBe('refresh_token');
        });
    });
});