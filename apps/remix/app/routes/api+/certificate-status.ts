import { getCertificateStatus } from '@documenso/lib/server-only/cert/cert-status';

export function loader() {
  try {
    const certStatus = getCertificateStatus();

    return Response.json({
      ...certStatus,
      timestamp: new Date().toISOString(),
      setupGuide: 'https://docs.documenso.com/developers/self-hosting/signing-certificate',
      automatedSetup: 'curl -fsSL https://get.documenso.com/setup | sh',
    });
  } catch (err) {
    console.error('Certificate status check failed:', err);

    return Response.json(
      {
        isAvailable: false,
        error: err instanceof Error ? err.message : 'Certificate status check failed',
        timestamp: new Date().toISOString(),
        setupGuide: 'https://docs.documenso.com/developers/self-hosting/signing-certificate',
        automatedSetup: 'curl -fsSL https://get.documenso.com/setup | sh',
      },
      { status: 500 },
    );
  }
}
