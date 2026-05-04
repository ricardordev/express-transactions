import { z } from "zod";

export const loginSchema = z.object({
    login: z.string().trim().min(1, "Login is required.").max(999),
    password: z.string().trim().min(1, "Password is required.").max(999),
}).strict();

export const refreshSchema = z.object({
    refresh_token: z.string().trim().optional(),
    lookup_key: z.string().trim().min(1, "lookup_key is required."),
}).strict();
