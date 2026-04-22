import { Buffer } from 'node:buffer';

import { scanFileForMalware } from '@documenso/lib/server-only/document/scanner';

// Testing the Virus Fingerprint
const EICAR_STRING = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

async function runTest() {
  console.log('Starting Malware Scanner Isolation Test...');

  const buffer = Buffer.from(EICAR_STRING);

  try {
    const isInfected = await scanFileForMalware(buffer);

    if (isInfected) {
      console.log('TEST PASSED: The scanner successfully caught the virus!');
    } else {
      console.log('TEST FAILED: The scanner marked the virus as CLEAN.');
    }
  } catch (error) {
    console.error('TEST CRASHED:', error);
  }
}

void runTest();
