import { hash, compare } from "bcryptjs";

export const Hash = async (
  password: string,
  saltRounds: number = 12
): Promise<string> => {
  return hash(password, saltRounds);
};

export const Compare = async (
  plainText: string,
  cipherText: string
): Promise<boolean> => {
  return compare(plainText, cipherText);
};