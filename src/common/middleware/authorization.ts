import type { NextFunction, Request, Response } from "express";
import type { RoleEnum } from "../enum/user.enum.js"; // use your actual enum

export const authorization = (roles: RoleEnum[] = []) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new Error("Unauthorized", { cause: 403 });
    }

    next();
  };
};