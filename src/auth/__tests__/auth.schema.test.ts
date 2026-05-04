import { describe, it, expect } from 'vitest';
import { loginSchema, refreshSchema } from '../auth.schema';

describe('Auth Schemas', () => {
    describe('loginSchema', () => {
        it('should accept valid login and password', () => {
            const result = loginSchema.safeParse({ login: 'john', password: 'secret' });
            expect(result.success).toBe(true);
        });

        it('should reject empty login', () => {
            const result = loginSchema.safeParse({ login: '', password: 'secret' });
            expect(result.success).toBe(false);
        });

        it('should reject empty password', () => {
            const result = loginSchema.safeParse({ login: 'john', password: '' });
            expect(result.success).toBe(false);
        });

        it('should reject extra fields (strict)', () => {
            const result = loginSchema.safeParse({ login: 'john', password: 'secret', extra: true });
            expect(result.success).toBe(false);
        });

        it('should trim whitespace', () => {
            const result = loginSchema.parse({ login: '  john  ', password: 'secret' });
            expect(result.login).toBe('john');
        });
    });

    describe('refreshSchema', () => {
        it('should accept valid refresh data with refresh_token', () => {
            const result = refreshSchema.safeParse({ refresh_token: 'abc', lookup_key: 'def' });
            expect(result.success).toBe(true);
        });

        it('should allow refresh_token to be optional', () => {
            const result = refreshSchema.safeParse({ lookup_key: 'def' });
            expect(result.success).toBe(true);
        });

        it('should reject empty lookup_key', () => {
            const result = refreshSchema.safeParse({ lookup_key: '' });
            expect(result.success).toBe(false);
        });

        it('should reject missing lookup_key', () => {
            const result = refreshSchema.safeParse({ refresh_token: 'abc' });
            expect(result.success).toBe(false);
        });
    });
});