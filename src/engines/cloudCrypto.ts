const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type CloudEnvelope = {
  v: 1;
  kdf: 'PBKDF2';
  alg: 'AES-GCM';
  iterations: number;
  salt: string;
  iv: string;
  ct: string;
};

const PBKDF2_ITERATIONS = 210000;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isCloudEnvelope(value: unknown): value is CloudEnvelope {
  return !!value
    && typeof value === 'object'
    && (value as CloudEnvelope).v === 1
    && (value as CloudEnvelope).alg === 'AES-GCM'
    && typeof (value as CloudEnvelope).ct === 'string';
}

export async function encryptForCloud(data: unknown, passphrase: string): Promise<CloudEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
    key,
    encoder.encode(JSON.stringify(data))
  );
  return {
    v: 1,
    kdf: 'PBKDF2',
    alg: 'AES-GCM',
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ciphertext))
  };
}

export async function decryptFromCloud(envelope: CloudEnvelope, passphrase: string): Promise<unknown> {
  const key = await deriveKey(passphrase, fromBase64(envelope.salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.iv) as unknown as ArrayBuffer },
    key,
    fromBase64(envelope.ct) as unknown as ArrayBuffer
  );
  return JSON.parse(decoder.decode(plaintext));
}
