import mongoose from "mongoose";
import  { GenderEnum, ProviderEnum, RoleEnum } from "../../common/enum/user.enum";
import { hashSync } from "bcryptjs";
import sendEmail from "../../common/service/sendEmail.js";


export interface IUser {
    fName: string;
    lName: string;
    email: string;
    password?: string;
    phone?: string;
    gender: GenderEnum;
    role: RoleEnum;
    provider: ProviderEnum;
    isConfirmed: boolean;
    profileImage?: string;
    bio?: string;
    isPrivate: boolean;         // false = public profile, true = private profile
    changeCredentialAt?: Date;  // every token issued before this date is rejecte
}

const userSchema= new mongoose.Schema<IUser>({
    fName: {type:String,trim:true,minlength:2,maxlength:100,required:true},
    lName: {type:String,trim:true,minlength:2,maxlength:100,required:true},
    email: {type:String,trim:true,required:true,unique:true},
    password: {type:String,trim:true,required:true},
    phone: String,
    gender: {type:String,enum:GenderEnum,default:GenderEnum.male},
    provider: {type:String,enum:ProviderEnum,default:ProviderEnum.system},
    role: {type:String,enum:RoleEnum,default:RoleEnum.user},
    isConfirmed: Boolean,
    profileImage:String,
    bio: String,
    isPrivate: {type:Boolean,default:false},
    changeCredentialAt: Date

},{
        timestamps:true,
        strictQuery:true,
          toJSON: {
        transform: (_doc, ret: Record<string, any>) => {
            delete ret.password
            delete ret.__v
            return ret
        }
    }
})
// Hook middleware
// userSchema.pre("validate",async function(){
//     console.log("===Pre Validated===");
//     console.log(this);
// })
// userSchema.pre("save",async function(){
//     console.log("===Pre Saved===");
//     console.log(this);
//     this.password=hashSync(this.password,12);
// })
// userSchema.post("save",async function(){
//     console.log("===Post Saved===");
//     console.log(this);
//     await sendEmail({
//         to:this.email,
//         subject:"Welcome to our platform",
//         text:`Hello ${this.fName} ${this.lName},\n\nWelcome to our platform! We're excited to have you on board.`
//     })
   
// })
// userSchema.post("validate",async function(){
//     console.log("===Post validated===");
//     console.log(this);
// })
userSchema.index({ fName: 1, lName: 1 })


const  userModel=mongoose.models.User || mongoose.model<IUser>("User",userSchema)

export default userModel