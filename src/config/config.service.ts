import { config } from "dotenv";
import { resolve } from "node:path";

const NODE_ENV = process.env.NODE_ENV

const envPath = {
    development: ".env.development",
    production: ".env.production"
}
config({ path: resolve(envPath[NODE_ENV as keyof typeof envPath] ?? ".env") });

export const  PORT = +process.env.PORT!
export const MONGO_URI = process.env.DB_URI!
export const REDIS_URL = process.env.REDIS_URL as string;
export const EMAIL = process.env.EMAIL
export const PASSWORD = process.env.PASSWORD
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
export const ACCESS_TOKEN_SIGNATURE = process.env.ACCESS_TOKEN_SIGNATURE as string;
export const REFRESH_TOKEN_SIGNATURE = process.env.REFRESH_TOKEN_SIGNATURE as string;
export const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN
export const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
