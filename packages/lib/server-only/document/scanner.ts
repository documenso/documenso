import { Buffer } from 'node:buffer';
import net from 'node:net';

export const scanFileForMalware = async (input: Buffer): Promise<boolean> => {
  if (process.env.NEXT_PRIVATE_ENABLE_MALWARE_SCAN !== 'true') {
    return false;
  }

  const host = process.env.NEXT_PRIVATE_CLAMAV_HOST || '127.0.0.1';
  const port = Number(process.env.NEXT_PRIVATE_CLAMAV_PORT) || 3310;

  return new Promise((resolve, reject) => {
    console.log(`Streaming bytes to ClamAV at ${host}:${port}...`);

    const client = net.createConnection({ host, port }, () => {
      client.write('nINSTREAM\n');

      // Send the buffer in one chunk: [length (4 bytes, big-endian)][data]
      const lengthBuf = Buffer.alloc(4);
      lengthBuf.writeUInt32BE(input.length);

      client.write(lengthBuf);
      client.write(input);

      //signal end of stream
      const endBuf = Buffer.alloc(4).fill(0);
      client.write(endBuf);
    });

    let response = '';

    client.on('data', (data) => {
      response += data.toString();
    });

    client.on('end', () => {
      // ClamAV response format is "stream: OK" or "stream: <virus name> FOUND"
      if (response.includes('FOUND')) {
        console.error(`MALWARE DETECTED: ${response.trim()}`);
        resolve(true);
      } else {
        console.log('File is clean.');
        resolve(false);
      }
    });

    client.on('error', (err) => {
      console.error('Malware Scanner Socket Error:', err);
      reject(new Error('Could not verify file security. Please try again later.'));
    });

    //  10-second timeout for the scan
    client.setTimeout(10000, () => {
      client.destroy();
      reject(new Error('Malware scan timed out.'));
    });
  });
};
