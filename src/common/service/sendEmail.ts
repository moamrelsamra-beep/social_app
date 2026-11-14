import { randomInt } from "crypto";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer/index.js";
import { EMAIL, PASSWORD } from "../../config/config.service.js";

interface ISendEmail {
  to: string | string[];
  subject: string;
  text?: string; 
  html?: string;
  attachments?: Mail.Attachment[];
}

const sendEmail = async ({
  to,
  subject,
  text,
  html,
  attachments,
}: ISendEmail): Promise<boolean> => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL,
      pass: PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from: `"Mohamed" <${EMAIL}>`,
    to,
    subject,
    text: text || "",
    html: html || "",
    attachments: attachments || [],
  });

  return info.accepted.length > 0;
};

export const generate_otp = async (): Promise<string> => {
  return randomInt(100000, 1000000).toString();
};

export default sendEmail;