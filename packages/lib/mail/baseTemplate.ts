import { NEXT_PUBLIC_WEBAPP_URL } from "../constants";

export const baseEmailTemplate = (message: string, content: string) => {
  const html = `
    <div style="background-color: #eaeaea; padding: 2%;">
      <div style="text-align:center; margin: auto; font-size: 14px; color: #353434; max-width: 500px; border-radius: 0.375rem; background: white; padding: 50px">
        <img src="${NEXT_PUBLIC_WEBAPP_URL}/logo_h.png" alt="Documenso Logo" style="width: 180px; display: block; margin: auto; margin-bottom: 14px;">
        ${message} 
        ${content}
      </div>
    `;

  const footer = `     
      <div style="text-align: left; line-height: 18px; color: #666666; margin: 24px">
        <div>
          <b>Do not forward.</b>
          <br>
          This email gives access to a secure document. Keep it secret and do not forward this email.
        </div>
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
    </div>
      `;

  return html + footer;
};

export default baseEmailTemplate;
