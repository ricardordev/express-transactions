import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Mock console.error to suppress output
vi.spyOn(console, 'error').mockImplementation(() => { });

// We need to import Prisma — but to avoid requiring generated code, mock it
vi.mock('../../generated/prisma/client', () => ({
    Prisma: {
        PrismaClientKnownRequestError: class MockPrismaError extends Error {
            code: string;
            constructor(message: string, { code }: { code: string; clientVersion: string }) {
                super(message);
                this.code = code;
            }
        },
    },
}));

import { errorHandler } from '../error-handler';
import { Prisma } from '../../generated/prisma/client';

describe('errorHandler', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;
    let statusJson: any;

    beforeEach(() => {
        vi.clearAllMocks();
        statusJson = {};
        req = {};
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockImplementation((obj) => { statusJson = obj; return res; }),
        };
        next = vi.fn();
        process.env.NODE_ENV = 'development';
    });

    it('should return 400 for ZodError', () => {
        const zodError = new ZodError([
            { message: 'Required', path: ['name'], code: 'invalid_type' } as any,
        ]);

        errorHandler(zodError, req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(statusJson).toHaveProperty('message', 'Validation failed');
        expect(statusJson).toHaveProperty('details', zodError.issues);
    });

    it('should return 404 for Prisma P2025 error', () => {
        const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
            code: 'P2025',
            clientVersion: '7.0.0',
        });

        errorHandler(prismaError, req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(statusJson).toHaveProperty('message', 'Record not found.');
    });

    it('should return 500 for generic Error with message in development', () => {
        errorHandler(new Error('Something broke'), req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(statusJson).toHaveProperty('message', 'Something broke');
    });

    it('should sanitize error message in production', () => {
        process.env.NODE_ENV = 'production';

        errorHandler(new Error('Internal secret'), req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(statusJson).toHaveProperty('message', 'An unexpected error occurred.');
    });

    it('should return 500 for non-Error objects', () => {
        errorHandler('plain string error', req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(statusJson).toHaveProperty('message', 'An unexpected error occurred.');
    });

    it('should return 500 for null/undefined errors', () => {
        errorHandler(null, req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(statusJson).toHaveProperty('message', 'An unexpected error occurred.');
    });
});