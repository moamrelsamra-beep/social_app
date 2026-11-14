import type { NextFunction, Request, Response } from "express";
import type { Model } from "mongoose";
import userModel from "../../DB/models/user.model.js";
import { AppError } from "../utils/globalErrorHandling.js";
import {
  extractToken,
  isRevoked,
  issuedBeforeCredentialChange,
  verifyAccessToken,
} from "../service/token.service.js";

export const authentication = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const { authorization } = req.headers;

  if (!authorization) {
    throw new AppError("Token not exist", 401);
  }

  // throws JsonWebTokenError / TokenExpiredError -> mapped to 401 by the global error handler
  const decoded = verifyAccessToken(extractToken(authorization));

  if (!decoded?.id || !decoded.jti) {
    throw new AppError("Invalid token", 401);
  }

  const user = await (userModel as Model<any>).findById(decoded.id);
  if (!user) {
    throw new AppError("User not exist", 404);
  }

  if (!user.isConfirmed) {
    throw new AppError("User not confirmed yet", 403);
  }

  if (issuedBeforeCredentialChange(user, decoded.iat)) {
    throw new AppError("Token expired, you must log in again", 401);
  }

  if (await isRevoked(user._id.toString(), decoded.jti)) {
    throw new AppError("Invalid revoked token, you should login again", 401);
  }

  req.user = user;
  req.decoded = decoded;
  next();
};