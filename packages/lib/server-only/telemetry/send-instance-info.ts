export type SendInstanceInfo = {
  uniqueId: string;
  timestamp: Date;
  version: string;
};

export const sendInstanceInfo = async ({ uniqueId, timestamp, version }: SendInstanceInfo) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTelemetryDisabled = process.env.DISABLE_TELEMETRY === 'true';

  if (!isProduction || isTelemetryDisabled) {
    return;
  }

  const url = 'https://documenso-instances.fly.dev/ping';

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        uniqueId: String(uniqueId),
        timestamp: new Date(timestamp).toISOString(),
        version,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to record instance, failed with status code ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(error);
  }
};
