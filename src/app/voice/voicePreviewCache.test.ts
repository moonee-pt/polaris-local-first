import { describe, expect, it, vi } from 'vitest';
import type { VoiceGenerationSettings } from '../../types/domain';

const base: VoiceGenerationSettings = {
  enabled: true,
  providerType: 'fishaudio',
  baseUrl: 'https://api.fish.audio',
  path: '/v1/tts',
  model: 's1',
  voice: 'voice-a',
  format: 'mp3'
};

async function loadModule() {
  vi.resetModules();
  return import('./voicePreviewCache');
}

describe('voicePreviewCache', () => {
  it('keys differ by voice, model, provider, address and format', async () => {
    const { buildVoicePreviewCacheKey } = await loadModule();
    const key = buildVoicePreviewCacheKey(base);
    expect(buildVoicePreviewCacheKey(base)).toBe(key);
    expect(buildVoicePreviewCacheKey({ ...base, voice: 'voice-b' })).not.toBe(key);
    expect(buildVoicePreviewCacheKey({ ...base, model: 's2' })).not.toBe(key);
    expect(buildVoicePreviewCacheKey({ ...base, providerType: 'minimax' })).not.toBe(key);
    expect(buildVoicePreviewCacheKey({ ...base, baseUrl: 'https://api.other' })).not.toBe(key);
    expect(buildVoicePreviewCacheKey({ ...base, format: 'wav' })).not.toBe(key);
  });

  it('replays a stored clip for the same settings and misses on a different voice', async () => {
    const { writeVoicePreviewBlob, readVoicePreviewBlob } = await loadModule();
    const blob = new Blob(['clip'], { type: 'audio/mpeg' });
    writeVoicePreviewBlob(base, blob);
    expect(readVoicePreviewBlob(base)).toBe(blob);
    expect(readVoicePreviewBlob({ ...base, voice: 'voice-b' })).toBeNull();
  });

  it('keeps the newest 24 clips and drops the oldest', async () => {
    const { writeVoicePreviewBlob, readVoicePreviewBlob } = await loadModule();
    for (let index = 0; index < 25; index += 1) {
      writeVoicePreviewBlob({ ...base, voice: `v${index}` }, new Blob([`${index}`]));
    }
    expect(readVoicePreviewBlob({ ...base, voice: 'v0' })).toBeNull();
    expect(readVoicePreviewBlob({ ...base, voice: 'v24' })).not.toBeNull();
  });
});
