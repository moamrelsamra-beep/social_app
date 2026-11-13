import type { JwtPayload } from "jsonwebtoken";
import type { HydratedDocument } from "mongoose";
import type { IUser } from "../../DB/models/user.model.js"; // adjust to where IUser lives

declare global {
  namespace Express {
    interface Request {
      user?: HydratedDocument<IUser>;
      decoded?: JwtPayload;
    }
  }
}

export {};