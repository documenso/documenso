import { getCertificateStatus } from '@documenso/lib/server-only/cert/cert-status';

export const loader = () => {
  try {
    const certStatus = getCertificateStatus();

    return Response.json({
      isAvailable: certStatus.isAvailable,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      {
        isAvailable: false,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
};
