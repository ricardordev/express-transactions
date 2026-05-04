import { Prisma } from "../generated/prisma/client";

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        totalItems: number;
        currentPage: number;
        itemsPerPage: number;
        totalPages: number;
    };
}

export interface Transaction {
    id: number;
    hash?: string;
    name: string;
    amount: Prisma.Decimal;
    created_at: Date;
    created_by: number | null;
    deleted_at: Date | null;
}
