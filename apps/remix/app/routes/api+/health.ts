import {
  getCertificateHealthSummary,
  getCertificateStatus,
} from '@documenso/lib/server-only/cert/cert-status';
import { prisma } from '@documenso/prisma';

export async function loader() {
  const checks = {
    database: { status: 'ok', message: 'Database connection healthy' },
    certificate: { status: 'ok', message: 'Certificate not checked' },
  };

  let overallStatus = 'ok';

  // Database health check
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    checks.database = {
      status: 'error',
      message: err instanceof Error ? err.message : 'Database connection failed',
    };
    overallStatus = 'error';
  }

  // Certificate health check
  try {
    const certStatus = getCertificateStatus();
    if (certStatus.isAvailable) {
      checks.certificate = {
        status: 'ok',
        message: getCertificateHealthSummary(),
      };
    } else {
      checks.certificate = {
        status: 'warning',
        message: `Certificate not available: ${certStatus.error}`,
      };
      if (overallStatus === 'ok') {
        overallStatus = 'warning';
      }
    }
  } catch (err) {
    checks.certificate = {
      status: 'error',
      message: err instanceof Error ? err.message : 'Certificate check failed',
    };
    overallStatus = 'error';
  }

  const responseStatus = overallStatus === 'error' ? 500 : 200;
  const responseMessage =
    overallStatus === 'ok'
      ? 'All systems operational'
      : overallStatus === 'warning'
        ? 'Some services have warnings'
        : 'System errors detected';

  return Response.json(
    {
      status: overallStatus,
      message: responseMessage,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: responseStatus },
  );
}
