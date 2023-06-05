import { resetPasswordTemplate } from "@documenso/lib/mail";
import { NEXT_PUBLIC_WEBAPP_URL } from "../constants";
import { sendMail } from "./sendMail";
import { User } from "@prisma/client";

export const sendResetPassword = async (user: User, token: string) => {
  await sendMail(
    user.email,
    "Forgot password?",
    resetPasswordTemplate(`${NEXT_PUBLIC_WEBAPP_URL}/auth/reset/${token}`, "Reset Your Password")
  ).catch((err) => {
    throw err;
  });
};
