import jwt from "jsonwebtoken";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import { randomUUID } from "crypto";
import type { HydratedDocument } from "mongoose";
import type { IUser } from "../../DB/models/user.model.js";
import redis from "../../DB/redis.connection.js";
import {
    ACCESS_TOKEN_EXPIRES_IN,
    ACCESS_TOKEN_SIGNATURE,
    REFRESH_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_SIGNATURE,
} from "../../config/config.service.js";

// Redis key used to mark a session (jti) as revoked
export const revokeKey = (userId: string, jti: string) => `revoke_token::${userId}::${jti}`

/**
 * Access Token (short life) + Refresh Token (long life).
 * Both share the same `jti` (= one login session), so revoking the jti kills the pair.
 */
export const generateTokens = (user: HydratedDocument<IUser>) => {
    const jti = randomUUID()
    const payload = { id: user._id.toString(), role: user.role }

    const accessToken = jwt.sign(payload, ACCESS_TOKEN_SIGNATURE, {
        expiresIn: ACCESS_TOKEN_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]>,
        jwtid: jti,
    })
    const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SIGNATURE, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]>,
        jwtid: jti,
    })

    return { accessToken, refreshToken }
}

// Accepts both "Bearer <token>" and the raw token
export const extractToken = (authorization: string) =>
    authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : authorization.trim()

const secondsFromExpiresIn = (expiresIn?: number | string) => {
    if (typeof expiresIn === "number") return expiresIn
    if (!expiresIn) return 0

    const match = /^(\d+)([smhd])?$/i.exec(expiresIn.trim())
    if (!match) return 0

    const value = Number(match[1])
    const unit = (match[2] ?? "s").toLowerCase()
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 } as const

    return value * (multipliers[unit as keyof typeof multipliers] ?? 1)
}

export const verifyAccessToken = (token: string) =>
    jwt.verify(token, ACCESS_TOKEN_SIGNATURE) as JwtPayload

export const verifyRefreshToken = (token: string) =>
    jwt.verify(token, REFRESH_TOKEN_SIGNATURE) as JwtPayload

export const isRevoked = async (userId: string, jti: string) => {
    const ttl = await redis.ttl(revokeKey(userId, jti))
    return !!ttl && ttl > 0
}

/**
 * Blacklists a session until its refresh token would have expired anyway
 * (the key deletes itself afterwards, so Redis never grows forever).
 */
export const revokeSession = async ({ userId, jti, iat }: { userId: string, jti: string, iat: number }) => {
    const refreshTokenExpiresIn = secondsFromExpiresIn(REFRESH_TOKEN_EXPIRES_IN)
    const ttl = iat + refreshTokenExpiresIn - Math.floor(Date.now() / 1000)

    if (ttl > 0) {
        await redis.setValue({ key: revokeKey(userId, jti), value: "revoked", ttl })
    }
}

/**
 * true when the user changed password / logged out of all devices AFTER the token was issued.
 * (compared in seconds because JWT `iat` has no milliseconds)
 */
export const issuedBeforeCredentialChange = (user: HydratedDocument<IUser>, iat?: number) =>
    !!user.changeCredentialAt && !!iat &&
    Math.floor(user.changeCredentialAt.getTime() / 1000) > iat

/**
 * Value for `user.changeCredentialAt` when the password changes / the user logs out of all devices.
 * JWT `iat` only has 1-second precision, so we round UP to the next full second:
 * every token issued up to now is rejected, no matter how fast the requests were.
 */
export const credentialChangeDate = () => new Date(Math.ceil(Date.now() / 1000) * 1000)