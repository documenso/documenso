import { CronExpressionParser } from 'cron-parser';

import { env } from '../utils/env';

export const getJobCronExpression = (envKey: string, fallback: string) => {
  const cronExpression = env(envKey) || fallback;

  try {
    CronExpressionParser.parse(cronExpression);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Invalid cron expression for ${envKey}: "${cronExpression}". ${message}`);
  }

  return cronExpression;
};
