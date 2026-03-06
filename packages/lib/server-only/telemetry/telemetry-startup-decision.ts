export type TGetTelemetryStartupDecisionOptions = {
  telemetryDisabled?: string | null;
  licenseKey?: string | null;
  telemetryKey?: string | null;
  telemetryHost?: string | null;
};

export type TGetTelemetryStartupDecisionResult =
  | {
      shouldStart: false;
      reason: 'disabled_by_env' | 'disabled_by_license_key' | 'missing_credentials';
    }
  | { shouldStart: true; reason: 'enabled'; telemetryKey: string; telemetryHost: string };

export const getTelemetryStartupDecision = ({
  telemetryDisabled,
  licenseKey,
  telemetryKey,
  telemetryHost,
}: TGetTelemetryStartupDecisionOptions): TGetTelemetryStartupDecisionResult => {
  if (telemetryDisabled === 'true') {
    return {
      shouldStart: false,
      reason: 'disabled_by_env',
    };
  }

  if (licenseKey?.trim()) {
    return {
      shouldStart: false,
      reason: 'disabled_by_license_key',
    };
  }

  if (!telemetryKey || !telemetryHost) {
    return {
      shouldStart: false,
      reason: 'missing_credentials',
    };
  }

  return {
    shouldStart: true,
    reason: 'enabled',
    telemetryKey,
    telemetryHost,
  };
};
