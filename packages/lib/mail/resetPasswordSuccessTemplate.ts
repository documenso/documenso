import { NEXT_PUBLIC_WEBAPP_URL } from "../constants";
import { User } from "@prisma/client";

export const resetPasswordSuccessTemplate = (user: User) => {
  return `
  <div style="background-color: #eaeaea; padding: 2%;">
    <div
        style="text-align:left; margin: auto; font-size: 14px; color: #353434; max-width: 500px; border-radius: 0.375rem; background: white; padding: 50px">
        <img src="${NEXT_PUBLIC_WEBAPP_URL}/logo_h.png" alt="Documenso Logo"
            style="width: 180px; display: block; margin-bottom: 14px;" />
        
        <h2 style="text-align: left; margin-top: 20px; font-size: 24px; font-weight: bold">Password updated!</h2>
        
        <p style="margin-top: 15px">
            Hi ${user.name ? user.name : user.email},
        </p>

        <p style="margin-top: 15px">
            We've changed your password as you asked. You can now sign in with your new password.
        </p>

        <p style="margin-top: 15px">
            Didn't request a password change? We are here to help you secure your account, just <a href="https://documenso.com">contact us</a>.
        </p>

        <p style="margin-top: 15px">
            <p style="font-weight: bold">
                The Documenso Team
            </p>
        </p>

        <p style="text-align:left; margin-top: 30px">
            <small>Want to send you own signing links?
                <a href="https://documenso.com">Hosted Documenso is here!</a>.</small>
        </p>
    </div>
    </div>
    <div style="text-align: left; line-height: 18px; color: #666666; margin: 24px">
        <div style="margin-top: 12px">
            <b>Need help?</b>
            <br>
            Contact us at <a href="mailto:hi@documenso.com">hi@documenso.com</a>
        </div>
        <hr size="1" style="height: 1px; border: none; color: #D8D8D8; background-color: #D8D8D8">
        <div style="text-align: center">
            <small>Easy and beautiful document signing by Documenso.</small>
        </div>
    </div>
`;
};
export default resetPasswordSuccessTemplate;
