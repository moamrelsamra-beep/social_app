import { Model } from "mongoose";
import userModel, { IUser } from "../models/user.model.js";
import  {DBRepository}  from "./db.repository.js";


export class UserRepository extends DBRepository<IUser> {
    
    constructor( model: Model<IUser>= userModel) {
        super(model)
    }



    createUser = async (data: Partial<IUser>) => {
    return await this.model.create([data])
    }


}