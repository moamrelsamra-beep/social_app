import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import userModel from "../../DB/models/user.model.js";
import { ACCESS_TOKEN_SIGNATURE } from "../../config/config.service.js";
//import { ttl } from "../../DB/redis.connection.js" // adjust to where your ttl helper is
import { redisService } from "../../DB/redis.connection.js";

export const authentication = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const { authorization } = req.headers;

  if (!authorization) {
    throw new Error("Token not exist", { cause: 401 });
  }

  const decoded = jwt.verify(
    authorization,
    ACCESS_TOKEN_SIGNATURE
  ) as JwtPayload;

  if (!decoded?.id) {
    throw new Error("Invalid token", { cause: 400 });
  }

  const user = await userModel.findById(decoded.id);
  if (!user) {
    throw new Error("User not exist", { cause: 404 });
  }

  if (!user.isConfirmed) {
    throw new Error("User not confirmed yet", { cause: 400 });
  }

  if (
    user.changeCredentialAt &&
    decoded.iat &&
    user.changeCredentialAt.getTime() > decoded.iat * 1000
  ) {
    throw new Error("Token expired, you must log in again", { cause: 401 });
  }

  if ((await ttl(`revoke_token::${user._id}::${decoded.jti}`)) > 0) {
    throw new Error("Invalid revoked token, you should login again", {
      cause: 401,
    });
  }

  req.user = user;
  req.decoded = decoded;
  next();
};