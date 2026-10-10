import crypto from 'node:crypto';
import { getSyncSecret } from './syncSecret.js';

// Server-side encryption at rest. The snapshot is encrypted with a key derived from
// SYNC_SECRET (or VITE_POLARIS_SYNC_SECRET) before it is written to MongoDB, so a raw
// database dump only ever contains ciphertext. The same secret also gates API access.

export function requireSyncSecret(): string {
  const secret = getSyncSecret();
  if (!secret) {
    throw new Error('SYNC_SECRET is not configured');
  }
  return secret;
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.scryptSync(secret, salt, 32);
}

// Returns a compact string envelope: v1.<salt>.<iv>.<tag>.<ciphertext> (all base64url).
export function encryptSnapshot(plainJson: string): string {
  const secret = requireSyncSecret();
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(secret, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainJson, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    salt.toString('base64url'),
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url')
  ].join('.');
}

export function decryptSnapshot(envelope: string): string {
  const secret = requireSyncSecret();
  const parts = envelope.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') {
    throw new Error('Malformed sync envelope');
  }
  const [, saltB64, ivB64, tagB64, ctB64] = parts;
  const salt = Buffer.from(saltB64, 'base64url');
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(ctB64, 'base64url');
  const key = deriveKey(secret, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function looksEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('v1.');
}
