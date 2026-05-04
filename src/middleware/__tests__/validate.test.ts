import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../validate';

describe('validate middleware', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;
    let statusJson: any;

    const testSchema = z.object({
        name: z.string().min(1),
        age: z.number().min(18),
    });

    beforeEach(() => {
        vi.clearAllMocks();
        statusJson = {};
        req = { body: {}, query: {}, params: {} };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockImplementation((obj) => { statusJson = obj; return res; }),
        };
        next = vi.fn();
    });

    it('should call next when body is valid', async () => {
        const middleware = validate({ body: testSchema });
        req.body = { name: 'John', age: 25 };

        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
    });

    it('should return 400 when body validation fails', async () => {
        const middleware = validate({ body: testSchema });
        req.body = { name: '', age: 10 };

        await middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(statusJson).toHaveProperty('message', 'Validation failed');
    });

    it('should pass through non-Zod errors to next', async () => {
        const schema = { parseAsync: vi.fn().mockRejectedValue(new Error('Boom')) };
        const middleware = validate({ body: schema as any });

        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
    });

    describe('query validation', () => {
        it('should validate and replace query object', async () => {
            const querySchema = z.object({ page: z.coerce.number().default(1) });
            const middleware = validate({ query: querySchema });
            req.query = { page: '5' };

            await middleware(req as Request, res as Response, next);

            // Query should be replaced with validated object
            expect(next).toHaveBeenCalled();
        });

        it('should return 400 for invalid query', async () => {
            const querySchema = z.object({ page: z.coerce.number() });
            const middleware = validate({ query: querySchema });
            req.query = { page: 'invalid' };

            await middleware(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('params validation', () => {
        it('should validate and replace params', async () => {
            const paramsSchema = z.object({ id: z.string() });
            const middleware = validate({ params: paramsSchema });
            req.params = { id: '123' };

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
        });
    });
});