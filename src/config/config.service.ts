import { config } from "dotenv";
import { resolve } from "node:path";

const NODE_ENV = process.env.NODE_ENV

const envPath = {
    development: ".env.development",
    production: ".env.production"
}
config({path:resolve(envPath[NODE_ENV as keyof typeof envPath]) as string});

export const  PORT = +process.env.PORT!
export const MONGO_URI = process.env.DB_URI!
export const EMAIL = process.env.EMAIL
export const PASSWORD = process.env.PASSWORD
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
export const ACCESS_TOKEN_SIGNATURE = process.env.ACCESS_TOKEN_SIGNATURE as string;