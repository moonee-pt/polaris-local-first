import { describe, expect, it } from 'vitest';
import { isAllowedPolarisApiOrigin } from './corsOrigin';

describe('isAllowedPolarisApiOrigin', () => {
  it('allows native and desktop app origins', () => {
    expect(isAllowedPolarisApiOrigin('capacitor://localhost')).toBe(true);
    expect(isAllowedPolarisApiOrigin('polaris://app')).toBe(true);
  });

  it('allows hosted preview origins', () => {
    expect(isAllowedPolarisApiOrigin('https://preview-user.vercel.app')).toBe(true);
  });

  it('allows the deployed qoder.zone origin', () => {
    expect(isAllowedPolarisApiOrigin('https://qoder.zone')).toBe(true);
    expect(isAllowedPolarisApiOrigin('https://www.qoder.zone')).toBe(true);
  });

  it('rejects an empty origin', () => {
    expect(isAllowedPolarisApiOrigin('')).toBe(false);
  });

  it('rejects unrelated origins', () => {
    expect(isAllowedPolarisApiOrigin('https://polaris.example.com')).toBe(false);
    expect(isAllowedPolarisApiOrigin('https://example.com')).toBe(false);
  });
});
