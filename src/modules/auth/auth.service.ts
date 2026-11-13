import express, { type NextFunction, type Request, type Response } from "express";
import userModel, {IUser} from "../../DB/models/user.model";
import { AppError } from "../../common/utils/globalErrorHandling";
import { signUpSchema } from "./auth.validation.js";
import { HydratedDocument, Types } from "mongoose";
import { DBRepository } from "../../DB/repositories/db.repository.js";
import { UserRepository } from "../../DB/repositories/user.repository.js";

class AuthService{

    private readonly _userRepo= new UserRepository()
    constructor(){ 
    }



  signup= async(req:Request, res:Response, next:NextFunction)=>{
    
    let {email,fName,lName,password,phone,gender}:IUser = req.body

      
        const result = signUpSchema.body.safeParse(req.body)

        console.log({result});
        
    
    

    const emailExist= await this._userRepo.findOne({ filter: { email } })
    if(emailExist) throw new AppError("Email already exist",409)
    
    const user = await this._userRepo.create({
        email,
        fName,
        lName,
        password,
        phone,
        gender
    } as Partial<IUser>)

    res.status(200).json({message:"DONE",user})
}
}


export default new AuthService()