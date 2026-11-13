import { type NextFunction, type Request, type Response } from "express";
import { ZodType } from "zod";
import { AppError } from "../utils/globalErrorHandling.js";

type ReqType = keyof Request
type SchemaType= Partial<Record<ReqType, ZodType>>

export const Validation = (schema:any) => {

    return async (req:Request,res:Response,next:NextFunction)=>{
         
        const ResultError= []
        for(const key of Object.keys(schema) as ReqType[]){

            if(!schema[key]) continue
            const result = schema[key].safeParse(req[key])
             if(!result.success){
                ResultError.push(result.error.message)

             }
        }
        if(ResultError.length>0){
            throw new AppError(JSON.parse(ResultError.join(",")),400)
        }
          next()
    }

}