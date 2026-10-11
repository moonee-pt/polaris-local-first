import { describe, expect, it } from 'vitest';
import { isStaleChunkError } from './composerChunkRecovery';

describe('isStaleChunkError', () => {
  it('recognizes the chunk load failures browsers raise for a missing build file', () => {
    expect(isStaleChunkError(new Error('Failed to fetch dynamically imported module: https://example.test/assets/a.js'))).toBe(true);
    expect(isStaleChunkError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isStaleChunkError(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('leaves unrelated failures alone', () => {
    expect(isStaleChunkError(new Error('读取附件失败'))).toBe(false);
    expect(isStaleChunkError('Failed to fetch')).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
  });
});
