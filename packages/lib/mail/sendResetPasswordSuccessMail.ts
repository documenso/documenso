import resetPasswordSuccessTemplate from "./resetPasswordSuccessTemplate";
import { sendMail } from "./sendMail";
import { User } from "@prisma/client";

export const sendResetPasswordSuccessMail = async (user: User) => {
  await sendMail(user.email, "Password Reset Success!", resetPasswordSuccessTemplate(user)).catch(
    (err) => {
      throw err;
    }
  );
};
