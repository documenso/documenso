export type LimitCounter = 'api' | 'document' | 'email';

export type RateLimitEntry = {
  window: `${number}${'s' | 'm' | 'h' | 'd'}`;
  max: number;
};
