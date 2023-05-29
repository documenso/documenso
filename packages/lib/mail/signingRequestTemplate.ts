import { NEXT_PUBLIC_WEBAPP_URL } from "../constants";
import { baseEmailTemplate } from "./baseTemplate";
import { Document as PrismaDocument } from "@prisma/client";

export const signingRequestTemplate = (
  message: string,
  document: any,
  recipient: any,
  ctaLink: string,
  ctaLabel: string,
  user: any
) => {
  const customContent = `
  <p style="margin: 30px 0px; text-align: center">
    <a href="${ctaLink}" style="background-color: #37f095; white-space: nowrap; color: white; border-color: transparent; border-width: 1px; border-radius: 0.375rem; font-size: 18px; padding-left: 16px; padding-right: 16px; padding-top: 10px; padding-bottom: 10px; text-decoration: none; margin-top: 4px; margin-bottom: 4px;">
      ${ctaLabel}
    </a>
  </p>
  <hr size="1" style="height:1px;border:none;color:#e0e0e0;background-color:#e0e0e0">
  Click the button to view "${document.title}".<br>
  <small>If you have questions about this document, you should ask ${user.name}.</small>
  <hr size="1" style="height:1px;border:none;color:#e0e0e0;background-color:#e0e0e0">
  <p style="margin-top: 14px;">
    <small>Want to send you own signing links? <a href="https://documenso.com">Hosted Documenso is here!</a>.</small>
  </p>`;

  const html = baseEmailTemplate(message, customContent);

  return html;
};

export default signingRequestTemplate;