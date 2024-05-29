export type SendInstanceInfo = {
  uniqueId: number;
  timestamp: Date;
  version: string;
};

export const sendInstanceInfo = async ({
  uniqueId,
  timestamp,
  version,
}: SendInstanceInfo): Promise<void> => {
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
        uniqueId,
        timestamp,
        version,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to record instance, failed with status code ${response.status}`);
    }

    await response.json();
  } catch (error) {
    console.error('Error posting instance information:', error);
  }
};
