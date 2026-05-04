import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../infrastructure/prisma', () => ({
    prisma: {
        transactions: {
            findMany: vi.fn(),
            count: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
    },
}));

import { TransactionsController } from '../transactions.controller';
import { TransactionsService } from '../transactions.service';

describe('TransactionsController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;
    let statusJson: any;

    beforeEach(() => {
        vi.clearAllMocks();
        statusJson = {};
        req = { query: {}, params: {}, body: {}, user: undefined };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockImplementation((obj) => { statusJson = obj; return res; }),
            send: vi.fn().mockReturnThis(),
        };
        next = vi.fn();
    });

    describe('get', () => {
        it('should return 200 with paginated results', async () => {
            const mockResponse = { data: [], meta: { totalItems: 0, currentPage: 1, itemsPerPage: 10, totalPages: 0 } };
            vi.spyOn(TransactionsService, 'list').mockResolvedValue(mockResponse as any);
            req.query = { page: '1', limit: '10' };

            await TransactionsController.get(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(statusJson).toEqual(mockResponse);
        });

        it('should call next on error', async () => {
            vi.spyOn(TransactionsService, 'list').mockRejectedValue(new Error('DB error'));
            await TransactionsController.get(req as Request, res as Response, next);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('getByHash', () => {
        it('should return 200 with a transaction', async () => {
            const tx = { id: 1, hash: 'abc', name: 'Tx', amount: 100 };
            vi.spyOn(TransactionsService, 'findByHash').mockResolvedValue(tx as any);
            req.params = { hash: 'abc' };

            await TransactionsController.getByHash(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(statusJson).toEqual(tx);
        });

        it('should return 404 if not found', async () => {
            vi.spyOn(TransactionsService, 'findByHash').mockResolvedValue(null);
            req.params = { hash: 'nonexistent' };

            await TransactionsController.getByHash(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(statusJson).toHaveProperty('message', 'Transaction not found.');
        });
    });

    describe('post', () => {
        it('should return 201 with created transaction', async () => {
            const created = { id: 1, hash: 'hash', name: 'New', amount: 50 };
            vi.spyOn(TransactionsService, 'create').mockResolvedValue(created as any);
            req.body = { name: 'New', amount: 50 };
            req.user = { id: 1 };

            await TransactionsController.post(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(TransactionsService.create).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 1 })
            );
        });

        it('should call next on error', async () => {
            vi.spyOn(TransactionsService, 'create').mockRejectedValue(new Error('DB error'));
            req.body = { name: 'New', amount: 50 };

            await TransactionsController.post(req as Request, res as Response, next);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('put', () => {
        it('should return 200 with updated transaction', async () => {
            const updated = { id: 1, name: 'Updated', amount: 200 };
            vi.spyOn(TransactionsService, 'update').mockResolvedValue(updated as any);
            req.params = { hash: 'abc' };
            req.body = { name: 'Updated', amount: 200 };

            await TransactionsController.put(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('delete', () => {
        it('should return 204 on successful soft delete', async () => {
            vi.spyOn(TransactionsService, 'softDelete').mockResolvedValue(true);
            req.params = { hash: 'abc' };
            req.user = { id: 1 };

            await TransactionsController.delete(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(204);
        });

        it('should return 401 if not authenticated', async () => {
            req.params = { hash: 'abc' };

            await TransactionsController.delete(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 403 if not owner', async () => {
            vi.spyOn(TransactionsService, 'softDelete').mockResolvedValue(false);
            req.params = { hash: 'abc' };
            req.user = { id: 99 };

            await TransactionsController.delete(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(statusJson).toHaveProperty('message', 'Not found or not the owner.');
        });
    });
});