import  { type NextFunction, type Request, type Response } from "express";

  
  
 export class AppError extends Error{
        constructor(public message: any, public statusCode:number =500){
            super(message)
        }
      }

export const GlobalErrorHandling= (err: AppError, req: Request, res: Response, next: NextFunction) => {
              const statusCode = err.statusCode || 500
              res.status(statusCode).json({
                  message: err.message,
                  statusCode,
                  stack: err.stack
              })
          }