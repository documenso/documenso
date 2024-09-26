declare namespace NodeJS {
  export interface ProcessEnv {
    NEXT_PUBLIC_WEBAPP_URL?: string;
    NEXT_PUBLIC_MARKETING_URL?: string;
    NEXT_PRIVATE_INTERNAL_WEBAPP_URL?:string;
    
    NEXT_PRIVATE_DATABASE_URL: string;

    NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID: string;

    NEXT_PRIVATE_STRIPE_API_KEY: string;
    NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET: string;
  }
}
