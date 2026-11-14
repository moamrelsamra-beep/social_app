import * as z from "zod";
import { GenderEnum } from "../../common/enum/user.enum.js";
import { passwordRule } from "../auth/auth.validation.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id")

const pagination = {
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
}

export const idSchema = {
    params: z.object({ id: objectId })
}

export const paginationSchema = {
    query: z.object(pagination)
}

export const idWithPaginationSchema = {
    params: z.object({ id: objectId }),
    query: z.object(pagination)
}

export const searchSchema = {
    query: z.object({
        q: z.string().trim().min(1, "Search text is required").max(50),
        ...pagination
    })
}

export const updateProfileSchema = {
    body: z.strictObject({
        fName: z.string().min(2).max(100).trim().optional(),
        lName: z.string().min(2).max(100).trim().optional(),
        phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number").optional(),
        gender: z.enum(GenderEnum).optional(),
        bio: z.string().max(300).trim().optional(),
    }).refine((data) => Object.keys(data).length > 0, { message: "Send at least one field to update" })
}

export const privacySchema = {
    body: z.strictObject({
        isPrivate: z.boolean()
    })
}

export const changePasswordSchema = {
    body: z.strictObject({
        oldPassword: z.string().min(1),
        password: passwordRule,
        cPassword: z.string()
    }).superRefine((data, ctx) => {
        if (data.password !== data.cPassword) {
            ctx.addIssue({ code: "custom", message: "Passwords don't match", path: ["cPassword"] });
        }
        if (data.password === data.oldPassword) {
            ctx.addIssue({ code: "custom", message: "New password must be different from the old one", path: ["password"] });
        }
    })
}