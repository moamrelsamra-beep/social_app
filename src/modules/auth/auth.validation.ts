import * as z from "zod";
import { GenderEnum } from "../../common/enum/user.enum.js";


export const signUpSchema = {
    body: z.strictObject({
        fName: z.string().min(2).max(100).trim(),
        lName: z.string().min(2).max(100).trim(),
        email: z.string().email(),
        password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
        cPassword: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
        gender: z.enum(GenderEnum),
        phone: z.string().regex(/^[0-9]{10}$/)  
    
     })
    //.refine((data) => {
    //     return data.password === data.cPassword;
    // }, {
    //     message: "Passwords don't match",
    //     path: ["cPassword"],
    // })
    .superRefine((data, ctx) => {
        if (data.password !== data.cPassword) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Passwords don't match",
                path: ["cPassword"]
            });
        }
    })
}
