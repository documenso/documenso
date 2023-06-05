import { NEXT_PUBLIC_WEBAPP_URL } from "../constants";

export const resetPasswordTemplate = (ctaLink: string, ctaLabel: string) => {
  const customContent = `
  <h2 style="margin-top: 36px; font-size: 24px; font-weight: bold;">Forgot your password?</h2>
  <p style="margin-top: 8px;">
    That's okay, it happens! Click the button below to reset your password.
  </p>
  
  <p style="margin: 30px 0px; text-align: center">
    <a href="${ctaLink}" style="background-color: #37f095; white-space: nowrap; color: white; border-color: transparent; border-width: 1px; border-radius: 0.375rem; font-size: 18px; padding-left: 16px; padding-right: 16px; padding-top: 10px; padding-bottom: 10px; text-decoration: none; margin-top: 4px; margin-bottom: 4px;">
      ${ctaLabel}
    </a>
  </p>
  <p style="margin-top: 20px;">
    <small>Want to send you own signing links? <a href="https://documenso.com">Hosted Documenso is here!</a>.</small>
  </p>`;

  const html = `
  <div style="background-color: #eaeaea; padding: 2%;">
    <div
        style="text-align:center; margin: auto; font-size: 14px; color: #353434; max-width: 500px; border-radius: 0.375rem; background: white; padding: 50px">
        <img src="${NEXT_PUBLIC_WEBAPP_URL}/logo_h.png" alt="Documenso Logo"
            style="width: 180px; display: block; margin: auto; margin-bottom: 14px;" />
        ${customContent}
    </div>
</div>
    `;

  const footer = `
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
</div>`;

  return html + footer;
};

export default resetPasswordTemplate;
