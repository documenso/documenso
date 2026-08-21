import * as fs from 'node:fs';

import { env } from '@documenso/lib/utils/env';

export const getCertificateStatus = () => {
  // Resolve the transport exactly as the signer does: unset means 'local',
  // not "some other transport" whose certificate is irrelevant. Otherwise a
  // deployment that never sets the variable reports the local certificate as
  // available even when the file is missing and every seal fails.
  const transport = env('NEXT_PRIVATE_SIGNING_TRANSPORT') || 'local';

  if (transport !== 'local') {
    return { isAvailable: true };
  }

  if (env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS')) {
    return { isAvailable: true };
  }

  const defaultPath = env('NODE_ENV') === 'production' ? '/opt/documenso/cert.p12' : './example/cert.p12';

  const filePath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH') || defaultPath;

  try {
    fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);

    const stats = fs.statSync(filePath);

    return { isAvailable: stats.size > 0 };
  } catch {
    return { isAvailable: false };
  }
};
