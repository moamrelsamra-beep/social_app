import { type NextFunction, type Request, type Response } from "express";
import { NODE_ENV_IS_PRODUCTION } from "./env.js";

export class AppError extends Error {
    constructor(public message: any, public statusCode: number = 500) {
        super(message)
    }
}

export const GlobalErrorHandling = (err: any, req: Request, res: Response, next: NextFunction) => {
    let statusCode: number = err.statusCode || 500
    let message = err.message

    // jsonwebtoken errors (bad signature, expired, malformed...) -> 401
    if (err?.name === "TokenExpiredError") { statusCode = 401; message = "Token expired" }
    else if (err?.name === "JsonWebTokenError" || err?.name === "NotBeforeError") { statusCode = 401; message = "Invalid token" }
    // mongoose: duplicate unique key / bad ObjectId
    else if (err?.code === 11000) { statusCode = 409; message = "Resource already exists" }
    else if (err?.name === "CastError") { statusCode = 400; message = "Invalid id" }

    res.status(statusCode).json({
        success: false,
        message,
        statusCode,
        ...(NODE_ENV_IS_PRODUCTION ? {} : { stack: err.stack })
    })
}