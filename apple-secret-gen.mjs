#!/bin/node
import { createPrivateKey } from 'crypto';
import dotenv from 'dotenv';
import { SignJWT } from 'jose';

dotenv.config();

const args = process.argv.slice(2).reduce((acc, arg, i) => {
  if (arg.match(/^--\w/)) {
    const key = arg.replace(/^--/, '').toLowerCase();
    acc[key] = process.argv[i + 3];
  }
  return acc;
}, {});

const {
  team_id = process.env.NEXT_PRIVATE_APPLE_TEAM_ID,
  iss = team_id,

  private_key = process.env.NEXT_PRIVATE_APPLE_PRIVATE_KEY,

  client_id = process.env.NEXT_PRIVATE_APPLE_CLIENT_ID,
  sub = client_id,

  key_id = process.env.NEXT_PRIVATE_APPLE_KEY_ID,
  kid = key_id,

  expires_in = 86400 * 180,
  exp = Math.ceil(Date.now() / 1000) + expires_in,
} = args;

/**
 * How long is the secret valid in seconds.
 * @default 15780000
 */
const expiresAt = Math.ceil(Date.now() / 1000) + expires_in;
const expirationTime = exp ?? expiresAt;

const secret = await new SignJWT({})
  .setAudience('https://appleid.apple.com')
  .setIssuer(iss)
  .setIssuedAt()
  .setExpirationTime(expirationTime)
  .setSubject(sub)
  .setProtectedHeader({ alg: 'ES256', kid })
  .sign(createPrivateKey(private_key.replace(/\\n/g, '\n')));

console.log(`
Apple client secret generated. Valid until: ${new Date(expirationTime * 1000)}
${secret}`);
