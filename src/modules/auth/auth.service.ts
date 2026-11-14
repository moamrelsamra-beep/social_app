import { type NextFunction, type Request, type Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { IUser } from "../../DB/models/user.model.js";
import { AppError } from "../../common/utils/globalErrorHandling.js";
import { UserRepository } from "../../DB/repositories/user.repository.js";
import { Compare, Hash } from "../../common/security/hash.js";
import { ProviderEnum } from "../../common/enum/user.enum.js";
import { sendOtp, verifyOtp } from "../../common/service/otp.service.js";
import {
    credentialChangeDate,
    generateTokens,
    isRevoked,
    issuedBeforeCredentialChange,
    revokeSession,
    verifyRefreshToken,
} from "../../common/service/token.service.js";
import { GOOGLE_CLIENT_ID } from "../../config/config.service.js";

class AuthService {

    private readonly _userRepo = new UserRepository()
    private readonly _googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

    // ───────────────────────── 1) Registration & email verification ─────────────────────────

    signup = async (req: Request, res: Response, next: NextFunction) => {
        const { email, fName, lName, password, phone, gender } = req.body

        const emailExist = await this._userRepo.findOne({ filter: { email } })
        if (emailExist) throw new AppError("Email already exist", 409)

        const [user] = await this._userRepo.create({
            email,
            fName,
            lName,
            password: await Hash(password),
            phone,
            gender
        } as Partial<IUser>)

        await sendOtp({
            email,
            purpose: "confirmEmail",
            subject: "Confirm your email",
            message: `Hello ${fName} ${lName}, welcome! Use this code to verify your email:`
        })

        res.status(201).json({
            success: true,
            message: "Account created. We sent a verification code to your email",
            user
        })
    }

    confirmEmail = async (req: Request, res: Response, next: NextFunction) => {
        const { email, otp } = req.body

        const user = await this._userRepo.findOne({ filter: { email, isConfirmed: false, provider: ProviderEnum.system } })
        if (!user) throw new AppError("Invalid request", 400)

        await verifyOtp({ email, purpose: "confirmEmail", otp })

        user.isConfirmed = true
        await user.save()

        res.status(200).json({ success: true, message: "Email confirmed successfully, you can login now" })
    }

    resendConfirmationOtp = async (req: Request, res: Response, next: NextFunction) => {
        const { email } = req.body

        const user = await this._userRepo.findOne({ filter: { email, isConfirmed: false, provider: ProviderEnum.system } })
        if (user) {
            await sendOtp({
                email,
                purpose: "confirmEmail",
                subject: "Confirm your email",
                message: "Use this code to verify your email:"
            })
        }

        // same answer whether or not the email exists (prevents user enumeration)
        res.status(200).json({ success: true, message: "If the account exists and is not confirmed, a new code was sent" })
    }

    // ───────────────────────── 2) Login & session generation ─────────────────────────

    login = async (req: Request, res: Response, next: NextFunction) => {
        const { email, password } = req.body

        const user = await this._userRepo.findOne({ filter: { email }, projection: "+password" })
        if (!user || user.provider !== ProviderEnum.system || !user.password || !(await Compare(password, user.password))) {
            throw new AppError("Invalid email or password", 401)
        }

        if (!user.isConfirmed) throw new AppError("Please confirm your email first", 403)

        const { accessToken, refreshToken } = generateTokens(user)

        res.status(200).json({ success: true, message: "Logged in successfully", accessToken, refreshToken, user })
    }

    // ───────────────────────── 3) Token refreshing & revocation ─────────────────────────

    refreshToken = async (req: Request, res: Response, next: NextFunction) => {
        const decoded = verifyRefreshToken(req.body.refreshToken)
        if (!decoded?.id || !decoded.jti || !decoded.iat) throw new AppError("Invalid token", 401)

        if (await isRevoked(decoded.id, decoded.jti)) {
            throw new AppError("Invalid revoked token, you should login again", 401)
        }

        const user = await this._userRepo.findById({ id: decoded.id })
        if (!user || !user.isConfirmed) throw new AppError("User not exist", 404)
        if (issuedBeforeCredentialChange(user, decoded.iat)) {
            throw new AppError("Token expired, you must log in again", 401)
        }

        // Refresh-token ROTATION: the used refresh token is revoked and a brand new pair is issued
        await revokeSession({ userId: decoded.id, jti: decoded.jti, iat: decoded.iat })
        const { accessToken, refreshToken } = generateTokens(user)

        res.status(200).json({ success: true, accessToken, refreshToken })
    }

    // revoke the current session only (this device)
    logout = async (req: Request, res: Response, next: NextFunction) => {
        const { id, jti, iat } = req.decoded!
        await revokeSession({ userId: id, jti: jti!, iat: iat! })

        res.status(200).json({ success: true, message: "Logged out successfully" })
    }

    // revoke every session of the user (all devices)
    logoutAll = async (req: Request, res: Response, next: NextFunction) => {
        req.user!.changeCredentialAt = credentialChangeDate()
        await req.user!.save()

        res.status(200).json({ success: true, message: "Logged out from all devices" })
    }

    // ───────────────────────── 4) Password reset flow (OTP) ─────────────────────────

    forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
        const { email } = req.body

        const user = await this._userRepo.findOne({ filter: { email, isConfirmed: true, provider: ProviderEnum.system } })
        if (user) {
            await sendOtp({
                email,
                purpose: "resetPassword",
                subject: "Reset your password",
                message: "Use this code to reset your password:"
            })
        }

        res.status(200).json({ success: true, message: "If the email exists, a reset code was sent" })
    }

    resetPassword = async (req: Request, res: Response, next: NextFunction) => {
        const { email, otp, password } = req.body

        const user = await this._userRepo.findOne({ filter: { email, isConfirmed: true, provider: ProviderEnum.system } })
        if (!user) throw new AppError("Invalid request", 400)

        await verifyOtp({ email, purpose: "resetPassword", otp })

        user.password = await Hash(password)
        user.changeCredentialAt = credentialChangeDate() // kicks out every old session
        await user.save()

        res.status(200).json({ success: true, message: "Password reset successfully, please login again" })
    }

    // ───────────────────────── 5) OAuth 2.0 (Google sign-in) ─────────────────────────

    // The client (web/mobile) signs in with Google, gets an ID token and sends it here.
    // We verify it with Google, then find-or-create the user and issue OUR tokens.
    googleLogin = async (req: Request, res: Response, next: NextFunction) => {
        const ticket = await this._googleClient
            .verifyIdToken({ idToken: req.body.idToken, audience: GOOGLE_CLIENT_ID })
            .catch(() => { throw new AppError("Invalid Google token", 401) })

        const payload = ticket.getPayload()
        if (!payload?.email || !payload.email_verified) {
            throw new AppError("Google email is not verified", 400)
        }
        const email = payload.email.toLowerCase()

        let user = await this._userRepo.findOne({ filter: { email } })

        if (!user) {
            const [created] = await this._userRepo.create({
                email,
                fName: payload.given_name || payload.name || email.split("@")[0]!,
                lName: payload.family_name || "User",
                provider: ProviderEnum.google,
                isConfirmed: true,
                ...(payload.picture ? { profileImage: payload.picture } : {})
            } as Partial<IUser>)
            user = created ?? null
        } else if (!user.isConfirmed) {
            // Someone registered this email with a password but never verified it.
            // Google just proved the real owner, so the owner takes the account over
            // and the unverified password is discarded.
            user.provider = ProviderEnum.google
            user.isConfirmed = true
            user.set("password", undefined)
            await user.save()
        }

        if (!user) throw new AppError("Could not create the account", 500)

        const { accessToken, refreshToken } = generateTokens(user)

        res.status(200).json({ success: true, message: "Logged in with Google", accessToken, refreshToken, user })
    }
}


export default new AuthService()