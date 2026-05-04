import net from 'node:net';
import { Buffer } from 'node:buffer';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

// ClamAV default StreamMaxLength is 25MB.
const MAX_SCAN_SIZE = Number(process.env.NEXT_PRIVATE_CLAMAV_MAX_FILE_SIZE) || 25 * 1024 * 1024;

export const scanFileForMalware = async (input: Buffer): Promise<boolean> => {
  if (process.env.NEXT_PRIVATE_ENABLE_MALWARE_SCAN !== 'true') {
    return false;
  }

  if (input.length > MAX_SCAN_SIZE) {
    throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
      userMessage: `File is too large to scan (Limit: ${MAX_SCAN_SIZE / (1024 * 1024)}MB).`,
      statusCode: 413,
    });
  }


  const host = process.env.NEXT_PRIVATE_CLAMAV_HOST || '127.0.0.1';
  const rawPort = process.env.NEXT_PRIVATE_CLAMAV_PORT;
  const port = rawPort && Number.isFinite(Number(rawPort)) ? Number(rawPort) : 3310;

return new Promise((resolve, reject) => {
  let finished = false;

  const cleanup = () => {
    finished = true;
    client.removeAllListeners();
    client.destroy();
  };

  const client = net.createConnection({ host, port }, () => {
    client.write('zINSTREAM\0');

    const lengthBuf = Buffer.alloc(4);
    lengthBuf.writeUInt32BE(input.length);
    client.write(lengthBuf);
    client.write(input);

    const endBuf = Buffer.alloc(4).fill(0);
    client.write(endBuf);
    client.end();
  });

  let response = '';
  client.on('data', (data) => { response += data.toString(); });

  client.on('end', () => {
    if (finished) return;
    cleanup();
    resolve(response.includes('FOUND'));
  });

  client.on('error', (err) => {
    if (finished) return;
    console.error('Malware Scanner Error:', err);
    cleanup();
    reject(new Error('Scanner unavailable'));
  });

  client.setTimeout(10000, () => {
    if (finished) return;
    cleanup();
    reject(new Error('Scanner timeout'));
  });
});
};
