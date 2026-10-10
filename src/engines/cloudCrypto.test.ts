import { describe, expect, it } from 'vitest';
import { decryptFromCloud, encryptForCloud, isCloudEnvelope } from './cloudCrypto';

describe('cloudCrypto AES-GCM round trip', () => {
  it('encrypts then decrypts back to the same object', async () => {
    const data = { runtimeState: { providers: [{ apiKey: 'sk-secret' }] }, chat: { a: 1 } };
    const envelope = await encryptForCloud(data, 'hunter2');
    expect(isCloudEnvelope(envelope)).toBe(true);
    expect(envelope.ct).not.toContain('sk-secret');
    const restored = await decryptFromCloud(envelope, 'hunter2');
    expect(restored).toEqual(data);
  });

  it('rejects a wrong passphrase', async () => {
    const envelope = await encryptForCloud({ x: 1 }, 'right-pass');
    await expect(decryptFromCloud(envelope, 'wrong-pass')).rejects.toThrow();
  });
});
