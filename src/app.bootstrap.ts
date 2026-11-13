import {PORT} from "./config/config.service";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import {rateLimit} from "express-rate-limit";
import { AppError, GlobalErrorHandling } from "./common/utils/globalErrorHandling";
import authRouter from "./modules/auth/auth.controller.js";
import connectionDB from "./DB/connectionDB.js";
import  RedisService  from "./DB/redis.connection.js";
const app = express();
const port =PORT;
const limiter = rateLimit({
  windowMs: 60*50*1000,
  limit: 20,
 message:{
   success: false,
   message: "Game over!!"
}
})
const bootstarp = async () => {

    app.use(express.json(), cors(), helmet(), limiter);


    await connectionDB()
    await RedisService.connect()
    app.get('/', (req: Request, res: Response, next: NextFunction) => {
        res.status(200).json({ message: "Hello World!" });
    });
        
    app.use("/auth", authRouter);
       app.use("{/*demo}",  (req: Request, res: Response, next: NextFunction)=> {
       throw new AppError (`Url: ${req.originalUrl} with method ${req.method} not found`, 404)
       // res.status(404).json({})})
       })

       app.use(GlobalErrorHandling)
       
       app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
        const statusCode = err.statusCode || 500
        res.status(statusCode).json({
            message: err.message,
            statusCode,
            stack: err.stack
        })
    })
       

    app.listen(port, () => console.log(`Example app is listening on port ${port}`));
};

export default bootstarp;