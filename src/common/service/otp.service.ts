import redis from "../../DB/redis.connection.js";
import sendEmail, { generate_otp } from "./sendEmail.js";
import { Compare, Hash } from "../security/hash.js";
import { AppError } from "../utils/globalErrorHandling.js";

export type OtpPurpose = "confirmEmail" | "resetPassword"

const OTP_TTL = 10 * 60          // the code is valid for 10 minutes
const RESEND_COOLDOWN = 60       // 1 minute between two emails
const MAX_ATTEMPTS = 5           // wrong guesses before the code is burned

const otpKey = (purpose: OtpPurpose, email: string) => `otp::${purpose}::${email}`
const attemptsKey = (purpose: OtpPurpose, email: string) => `otp_attempts::${purpose}::${email}`
const cooldownKey = (purpose: OtpPurpose, email: string) => `otp_cooldown::${purpose}::${email}`

/**
 * Generates a 6-digit OTP, stores only its HASH in Redis (with TTL) and emails the plain code.
 */
export const sendOtp = async ({ email, purpose, subject, message }: {
    email: string, purpose: OtpPurpose, subject: string, message: string
}) => {
    if (await redis.exists(cooldownKey(purpose, email))) {
        const wait = await redis.ttl(cooldownKey(purpose, email))
        throw new AppError(`Please wait ${wait && wait > 0 ? wait : RESEND_COOLDOWN} seconds before requesting a new code`, 429)
    }

    const otp = await generate_otp()
    await redis.setValue({ key: otpKey(purpose, email), value: await Hash(otp, 10), ttl: OTP_TTL })
    await redis.setValue({ key: cooldownKey(purpose, email), value: "1", ttl: RESEND_COOLDOWN })
    await redis.deleteKey(attemptsKey(purpose, email))

    await sendEmail({
        to: email,
        subject,
        html: `<p>${message}</p><h2 style="letter-spacing:4px">${otp}</h2><p>This code expires in ${OTP_TTL / 60} minutes. If you didn't request it, ignore this email.</p>`
    })
}

/**
 * Checks the OTP. Throws if it is wrong/expired. A valid OTP is deleted (one-time use).
 */
export const verifyOtp = async ({ email, purpose, otp }: {
    email: string, purpose: OtpPurpose, otp: string
}) => {
    const attempts = await redis.getValue(attemptsKey(purpose, email))
    if (Number(attempts) >= MAX_ATTEMPTS) {
        throw new AppError("Too many wrong attempts, request a new code", 429)
    }

    const hashed = await redis.getValue(otpKey(purpose, email))
    if (!hashed || typeof hashed !== "string") {
        throw new AppError("Code expired or not requested", 400)
    }

    if (!(await Compare(otp, hashed))) {
        const count = await redis.incr(attemptsKey(purpose, email))
        if (count === 1) await redis.expire({ key: attemptsKey(purpose, email), ttl: OTP_TTL })
        throw new AppError("Invalid code", 400)
    }

    await redis.deleteKey(otpKey(purpose, email))
    await redis.deleteKey(attemptsKey(purpose, email))
}