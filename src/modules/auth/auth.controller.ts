import {Router} from "express";
import AS  from "./auth.service.js";
import { Validation } from "../../common/middleware/validation.js";
import { signUpSchema } from "./auth.validation.js";

const authRouter = Router();

authRouter.post("/signup",Validation(signUpSchema), AS.signup);



export default authRouter;