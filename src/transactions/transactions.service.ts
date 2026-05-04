import { prisma } from "../infrastructure/prisma";
import { PaginatedResponse, Transaction } from "../types/index";

export class TransactionsService {
    static async list(page: number, limit: number): Promise<PaginatedResponse<Transaction>> {
        const skip = (page - 1) * limit;
        const where = { deleted_at: null };

        const [data, total] = await Promise.all([
            prisma.transactions.findMany({ where, skip, take: limit, orderBy: { id: "desc" } }),
            prisma.transactions.count({ where }),
        ]);

        return {
            data: data as Transaction[],
            meta: { totalItems: total, currentPage: page, itemsPerPage: limit, totalPages: Math.ceil(total / limit) },
        };
    }

    static async findByHash(hash: string): Promise<Transaction | null> {
        return prisma.transactions.findUnique({ where: { hash } }) as Promise<Transaction | null>;
    }

    static async create(data: { name: string; amount: number; created_at?: string; userId?: number }): Promise<Transaction> {
        const tx = await prisma.transactions.create({
            data: { name: data.name.trim(), amount: data.amount, created_by: data.userId ?? null, created_at: data.created_at ? new Date(data.created_at) : undefined },
        });

        if (data.userId) {
            await prisma.userTransactions.create({ data: { user_id: data.userId, transaction_id: tx.id } });
        }

        return tx as Transaction;
    }

    static async update(hash: string, data: { name: string; amount: number }): Promise<Transaction> {
        return prisma.transactions.update({
            where: { hash },
            data: { name: data.name.trim(), amount: data.amount },
        }) as Promise<Transaction>;
    }

    static async softDelete(hash: string, userId: number): Promise<boolean> {
        const result = await prisma.transactions.updateMany({
            where: { hash, created_by: userId, deleted_at: null },
            data: { deleted_at: new Date(), deleted_by: userId },
        });
        return result.count > 0;
    }
}
