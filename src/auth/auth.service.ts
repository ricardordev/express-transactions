import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import { prisma } from "../infrastructure/prisma";

interface TokenPair {
    access_token: string;
    refresh_token: string;
    lookup_key: string;
    expires_in: string;
}

interface RefreshTokenPayload {
    jti: string;
    sub: number;
    family: string;
    iat?: number;
    exp?: number;
}

export interface UserProfile {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    created_at: Date;
}

export class AuthService {
    private static readonly ACCESS_COOKIE = "access_token";
    private static readonly REFRESH_COOKIE = "refresh_token";

    static generateAccessToken(userId: number, tokenVersion: number = 0): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("JWT_SECRET not configured.");
        return jwt.sign({ id: userId, v: tokenVersion }, secret, {
            expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
        } as jwt.SignOptions);
    }

    private static generateRefreshToken(jti: string, userId: number, family: string): string {
        const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
        if (!secret) throw new Error("Refresh secret not configured.");
        return jwt.sign({ jti, sub: userId, family }, secret, {
            expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
        } as jwt.SignOptions);
    }

    private static verifyRefreshToken(token: string): RefreshTokenPayload {
        const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
        if (!secret) throw new Error("Refresh secret not configured.");
        const d = jwt.verify(token, secret) as JwtPayload & { jti: string; sub: number; family: string };
        return { jti: d.jti, sub: d.sub, family: d.family, iat: d.iat, exp: d.exp };
    }

    private static hash(token: string): string {
        return crypto.createHash("sha256").update(token).digest("hex");
    }

    private static parseDuration(d: string): number {
        const m = /^(\d+)([smhd])$/.exec(d);
        if (!m) return 7 * 86400000;
        const v = Number.parseInt(m[1]);
        switch (m[2]) {
            case "s": return v * 1000;
            case "m": return v * 60000;
            case "h": return v * 3600000;
            case "d": return v * 86400000;
            default: return 7 * 86400000;
        }
    }

    private static async createPair(userId: number, family: string): Promise<TokenPair> {
        const jti = crypto.randomUUID();
        const lookupKey = crypto.randomUUID();
        const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || "15m";

        const refreshToken = this.generateRefreshToken(jti, userId, family);
        const tokenHash = this.hash(refreshToken);
        const expiresAt = new Date(Date.now() + this.parseDuration(process.env.JWT_REFRESH_EXPIRES_IN || "7d"));

        const [user] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { token_version: true } }),
            prisma.refreshToken.create({
                data: { id: jti, tokenHash, lookupKey, userId, family, expiresAt },
            }),
        ]);

        return {
            access_token: this.generateAccessToken(userId, user!.token_version),
            refresh_token: refreshToken,
            lookup_key: lookupKey,
            expires_in: expiresIn,
        };
    }

    static async login(login: string, password: string): Promise<TokenPair> {
        const user = await prisma.user.findUnique({ where: { login } });
        if (!user || !bcrypt.compareSync(password, user.password)) throw new AuthError("Invalid credentials.", 401);
        return this.createPair(user.id, crypto.randomUUID());
    }

    static async refresh(refreshToken: string, lookupKey: string): Promise<TokenPair> {
        let decoded: RefreshTokenPayload;
        try { decoded = this.verifyRefreshToken(refreshToken); }
        catch { throw new AuthError("Invalid or expired refresh token.", 401); }

        const hash = this.hash(refreshToken);
        const tokens = await prisma.refreshToken.findMany({
            where: { lookupKey }, orderBy: { createdAt: "desc" }, take: 5,
        });
        const stored = tokens.find(t => t.tokenHash === hash);

        if (!stored) {
            const byId = await prisma.refreshToken.findUnique({ where: { id: decoded.jti } });
            if (byId) { await this.revokeFamily(byId.family); throw new AuthError("Token reuse detected.", 401); }
            throw new AuthError("Invalid refresh token.", 401);
        }

        if (stored.revokedAt) { await this.revokeFamily(stored.family); throw new AuthError("Token reuse detected.", 401); }
        if (new Date() > stored.expiresAt) throw new AuthError("Refresh token expired.", 401);

        await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
        return this.createPair(stored.userId, stored.family);
    }

    static async logout(userId: number, refreshToken: string): Promise<void> {
        let family: string;
        try { family = this.verifyRefreshToken(refreshToken).family; }
        catch { family = ''; }

        if (family) {
            await this.revokeFamily(family);
            await prisma.user.update({
                where: { id: userId },
                data: { token_version: { increment: 1 } },
            });
        }
    }

    static async getUserProfile(userId: number): Promise<UserProfile> {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new AuthError("User not found.", 404);
        return { id: user.id, login: user.login, name: user.name, email: user.email, created_at: user.created_at };
    }

    private static async revokeFamily(family: string): Promise<void> {
        const tokens = await prisma.refreshToken.findMany({
            where: { family, revokedAt: null },
            select: { userId: true },
        });

        await prisma.refreshToken.updateMany({
            where: { family, revokedAt: null },
            data: { revokedAt: new Date() },
        });

        // Invalidate all access tokens for affected users by bumping token_version
        const uniqueUserIds = [...new Set(tokens.map(t => t.userId))];
        for (const userId of uniqueUserIds) {
            await prisma.user.update({
                where: { id: userId },
                data: { token_version: { increment: 1 } },
            });
        }
    }

    static getAccessTokenCookieOptions() {
        const isProduction = process.env.NODE_ENV === "production";
        const maxAge = this.parseDuration(process.env.JWT_ACCESS_EXPIRES_IN || "15m");
        return { httpOnly: true, secure: isProduction, sameSite: "lax" as const, maxAge, path: "/" };
    }

    static getRefreshTokenCookieOptions() {
        const isProduction = process.env.NODE_ENV === "production";
        const maxAge = this.parseDuration(process.env.JWT_REFRESH_EXPIRES_IN || "7d");
        return { httpOnly: true, secure: isProduction, sameSite: "lax" as const, maxAge, path: "/auth" };
    }

    static get accessCookieName() { return this.ACCESS_COOKIE; }
    static get refreshCookieName() { return this.REFRESH_COOKIE; }
}

export class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 401) {
        super(message);
        this.name = "AuthError";
        this.statusCode = statusCode;
    }
}
