import { sendInstanceInfo } from '@documenso/lib/server-only/telemetry/send-instance-info';

export async function register() {
  await sendInstanceInfo({
    uniqueId: '1',
    timestamp: new Date(),
    version: '1.2.3',
  });
}
