import type { NextFunction, Request, Response } from "express";
import type { RoleEnum } from "../enum/user.enum.js"; // use your actual enum
import { AppError } from "../utils/globalErrorHandling.js";

export const authorization = (roles: RoleEnum[] = []) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError("Unauthorized",  403 );
    }

    next();
  };
};