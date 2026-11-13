import mongoose from "mongoose";
import { MONGO_URI } from "../config/config.service";


const ConnectionDB= async () => {

    await mongoose.connect(MONGO_URI)
    .then(()=>console.log("Database connected successfully"))
    .catch((err)=>console.log("Database connection failed",err))
}

export default ConnectionDB