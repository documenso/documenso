declare namespace NodeJS {
  export interface ProcessEnv {
    DATABASE_URL: string;
    NEXT_PUBLIC_WEBAPP_URL: string;
    NEXTAUTH_SECRET: string;
    NEXTAUTH_URL: string;
    
    SENDGRID_API_KEY?: string;
    SMTP_MAIL_HOST?: string;
    SMTP_MAIL_PORT?: string;
    SMTP_MAIL_USER?: string;
    SMTP_MAIL_PASSWORD?: string;
    
    MAIL_FROM: string;

    STRIPE_API_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID?: string;
    STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID?: string;
    
    NEXT_PUBLIC_ALLOW_SIGNUP?: string;
    NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS?: string;
  }
}
