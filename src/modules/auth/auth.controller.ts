import { Router } from "express";
import AS from "./auth.service.js";
import { Validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authentication.js";
import {
    confirmEmailSchema,
    forgotPasswordSchema,
    googleLoginSchema,
    loginSchema,
    refreshTokenSchema,
    resendOtpSchema,
    resetPasswordSchema,
    signUpSchema,
} from "./auth.validation.js";

const authRouter = Router();

// 1) registration & email verification
authRouter.post("/signup", Validation(signUpSchema), AS.signup);
authRouter.post("/confirm-email", Validation(confirmEmailSchema), AS.confirmEmail);
authRouter.post("/resend-otp", Validation(resendOtpSchema), AS.resendConfirmationOtp);

// 2) login (access token + refresh token)
authRouter.post("/login", Validation(loginSchema), AS.login);

// 3) refresh & revoke
authRouter.post("/refresh-token", Validation(refreshTokenSchema), AS.refreshToken);
authRouter.post("/logout", authentication, AS.logout);
authRouter.post("/logout-all", authentication, AS.logoutAll);

// 4) password reset
authRouter.post("/forgot-password", Validation(forgotPasswordSchema), AS.forgotPassword);
authRouter.post("/reset-password", Validation(resetPasswordSchema), AS.resetPassword);

// 5) Google OAuth 2.0
authRouter.post("/google", Validation(googleLoginSchema), AS.googleLogin);

export default authRouter;