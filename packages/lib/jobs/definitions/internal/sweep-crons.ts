import { CronExpressionParser } from 'cron-parser';

const DEFAULT_SWEEP_CRON = '*/15 * * * *';

/**
 * Resolve an internal sweep job's cron schedule from the environment, keeping
 * the 15-minute default for deployments that do not set an override (#2811).
 *
 * Invalid cron expressions throw at boot instead of silently disabling a sweep:
 * a mistyped schedule would otherwise leave expired recipients un-swept or
 * rate-limit entries accumulating with nothing pointing at the cause.
 */
export function resolveSweepCron(envKey: string, env: NodeJS.ProcessEnv = process.env): string {
  const raw = env[envKey]?.trim();

  if (!raw) {
    return DEFAULT_SWEEP_CRON;
  }

  try {
    CronExpressionParser.parse(raw);
  } catch {
    throw new Error(`${envKey} is not a valid cron expression: "${raw}"`);
  }

  return raw;
}
