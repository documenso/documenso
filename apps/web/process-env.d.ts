declare namespace NodeJs {
  export interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";

    NEXT_PUBLIC_WEBAPP_URL: string;

    DATABASE_URL: string;

    NEXTAUTH_SECRET: string;
    NEXTAUTH_URL: string;

    SENDGRID_API_KEY?: string;
    
    SMTP_MAIL_HOST?: string;
    SMTP_MAIL_PORT?: string;
    SMTP_MAIL_USER?: string;
    SMTP_MAIL_PASSWORD?: string;
      
    MAIL_FROM: string;

    ALLOW_SIGNUP: string;
  }
}
