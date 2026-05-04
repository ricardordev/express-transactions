import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { TransactionsService } from "./transactions.service";
import { paginationQuerySchema, createTransactionSchema, getTransactionParamsSchema, updateTransactionSchema, deleteTransactionParamsSchema } from "./transactions.schema";

export class TransactionsController {
    static async get(req: Request, res: Response, next: NextFunction) {
        try {
            const { page, limit } = req.query as unknown as z.infer<typeof paginationQuerySchema>;
            res.status(200).json(await TransactionsService.list(page, limit));
        } catch (err) { next(err); }
    }

    static async getByHash(req: Request, res: Response, next: NextFunction) {
        try {
            const { hash } = req.params as unknown as z.infer<typeof getTransactionParamsSchema>;
            const tx = await TransactionsService.findByHash(hash);
            if (!tx) { res.status(404).json({ error: true, message: "Transaction not found." }); return; }
            res.status(200).json(tx);
        } catch (err) { next(err); }
    }

    static async post(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body as unknown as z.infer<typeof createTransactionSchema>;
            const created = await TransactionsService.create({
                name: data.name, amount: data.amount, created_at: data.created_at, userId: req.user?.id,
            });
            res.status(201).json(created);
        } catch (err) { next(err); }
    }

    static async put(req: Request, res: Response, next: NextFunction) {
        try {
            const { hash } = req.params as unknown as z.infer<typeof getTransactionParamsSchema>;
            const data = req.body as unknown as z.infer<typeof updateTransactionSchema>;
            res.status(200).json(await TransactionsService.update(hash, data));
        } catch (err) { next(err); }
    }

    static async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { hash } = req.params as unknown as z.infer<typeof deleteTransactionParamsSchema>;
            const userId = req.user?.id;
            if (!userId) { res.status(401).json({ error: true, message: "Not authenticated." }); return; }
            const deleted = await TransactionsService.softDelete(hash, userId);
            if (!deleted) { res.status(403).json({ error: true, message: "Not found or not the owner." }); return; }
            res.status(204).send();
        } catch (err) { next(err); }
    }
}
