import * as fs from 'node:fs';
import * as os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

const envState: Record<string, string | undefined> = {};

vi.mock('@documenso/lib/utils/env', () => ({
  env: (variable: string) => envState[variable],
}));

const { getCertificateStatus } = await import('./cert-status');

describe('getCertificateStatus', () => {
  it('reports the local certificate as unavailable when the transport is unset and the file is missing', () => {
    envState.NEXT_PRIVATE_SIGNING_TRANSPORT = undefined;
    envState.NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS = undefined;
    envState.NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH = join(os.tmpdir(), 'documenso-cert-missing-test.p12');

    expect(getCertificateStatus()).toEqual({ isAvailable: false });
  });

  it('reports the local certificate as available when the transport is unset and the file exists', () => {
    const certPath = join(os.tmpdir(), `documenso-cert-present-${process.pid}.p12`);

    try {
      fs.writeFileSync(certPath, 'not-a-real-p12-but-non-empty');

      envState.NEXT_PRIVATE_SIGNING_TRANSPORT = undefined;
      envState.NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS = undefined;
      envState.NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH = certPath;

      expect(getCertificateStatus()).toEqual({ isAvailable: true });
    } finally {
      fs.rmSync(certPath, { force: true });
    }
  });

  it('checks the local file when the transport is explicitly local', () => {
    envState.NEXT_PRIVATE_SIGNING_TRANSPORT = 'local';
    envState.NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS = undefined;
    envState.NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH = join(os.tmpdir(), 'documenso-cert-missing-test.p12');

    expect(getCertificateStatus()).toEqual({ isAvailable: false });
  });

  it('skips the file check for non-local transports', () => {
    envState.NEXT_PRIVATE_SIGNING_TRANSPORT = 'gcloud-hsm';
    envState.NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH = join(os.tmpdir(), 'documenso-cert-missing-test.p12');

    expect(getCertificateStatus()).toEqual({ isAvailable: true });
  });

  it('accepts inline certificate contents without touching the filesystem', () => {
    envState.NEXT_PRIVATE_SIGNING_TRANSPORT = undefined;
    envState.NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS = 'inline-p12-contents';

    expect(getCertificateStatus()).toEqual({ isAvailable: true });
  });

  it('matches the signer: unset transport resolves to local, not to an unrelated transport', () => {
    const signerSource = fs.readFileSync(join(here, '../../../../packages/signing/index.ts'), 'utf8');
    const signerDefault = signerSource.match(/NEXT_PRIVATE_SIGNING_TRANSPORT'\)\s*\|\|\s*'local'/);

    expect(signerDefault).not.toBeNull();
  });
});
