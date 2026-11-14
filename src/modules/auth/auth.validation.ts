import * as z from "zod";
import { GenderEnum } from "../../common/enum/user.enum.js";

const passwordRule = z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    "Password must be at least 8 characters and contain a lowercase letter, an uppercase letter, a number and one of @$!%*?&")
const emailRule = z.email().trim().toLowerCase()
const otpRule = z.string().regex(/^\d{6}$/, "OTP must be 6 digits")

export const signUpSchema = {
    body: z.strictObject({
        fName: z.string().min(2).max(100).trim(),
        lName: z.string().min(2).max(100).trim(),
        email: emailRule,
        password: passwordRule,
        cPassword: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
        gender: z.enum(GenderEnum),
        phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number") 
     }) .superRefine((data, ctx) => {
        if (data.password !== data.cPassword) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Passwords don't match",
                path: ["cPassword"]
            });
        }
    })
}
export const confirmEmailSchema = {
    body: z.strictObject({
        email: emailRule,
        otp: otpRule
    })
}

export const resendOtpSchema = {
    body: z.strictObject({
        email: emailRule
    })
}

export const loginSchema = {
    body: z.strictObject({
        email: emailRule,
        password: z.string().min(1)
    })
}

export const refreshTokenSchema = {
    body: z.strictObject({
        refreshToken: z.string().min(1)
    })
}

export const forgotPasswordSchema = {
    body: z.strictObject({
        email: emailRule
    })
}

export const resetPasswordSchema = {
    body: z.strictObject({
        email: emailRule,
        otp: otpRule,
        password: passwordRule,
        cPassword: z.string()
    }).superRefine((data, ctx) => {
        if (data.password !== data.cPassword) {
            ctx.addIssue({
                code: "custom",
                message: "Passwords don't match",
                path: ["cPassword"]
            });
        }
    })
}

export const googleLoginSchema = {
    body: z.strictObject({
        idToken: z.string().min(1)
    })
}

export { passwordRule }