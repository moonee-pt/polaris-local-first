import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VoiceGenerationSettings } from '../../types/domain';
import type { VoiceGenerationResult } from '../../engines/voiceGenerationClient';

const assetStoreMocks = vi.hoisted(() => ({
  saveAsset: vi.fn(),
  getAssetBlob: vi.fn()
}));

vi.mock('../../infrastructure/assetStore', () => ({
  saveAsset: assetStoreMocks.saveAsset,
  getAssetBlob: assetStoreMocks.getAssetBlob
}));

afterEach(() => {
  Object.values(assetStoreMocks).forEach((mock) => mock.mockReset());
});

describe('messageSpeechCache', () => {
  it('saves generated speech as a file asset and returns message cache metadata', async () => {
    assetStoreMocks.saveAsset.mockResolvedValue({
      id: 'asset-speech',
      kind: 'file',
      name: 'Polaris-voice-20260614000102-abc12345.mp3',
      mimeType: 'audio/mpeg',
      size: 5,
      createdAt: 1781376062000
    });
    const settings: VoiceGenerationSettings = {
      enabled: true,
      providerType: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'key',
      model: 'tts-1',
      voice: 'alloy',
      format: 'mp3'
    };
    const result: VoiceGenerationResult = {
      blob: new Blob(['audio'], { type: 'audio/mpeg' }),
      mimeType: 'audio/mpeg',
      model: 'tts-1',
      voice: 'alloy',
      format: 'mp3'
    };

    const { saveMessageSpeechCache } = await import('./messageSpeechCache');
    const cache = await saveMessageSpeechCache({
      text: ' hello ',
      settings,
      result,
      createdAt: 1781376062000
    });

    expect(assetStoreMocks.saveAsset).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'file',
      name: expect.stringMatching(/^Polaris-voice-\d{14}-[a-f0-9]{8}\.mp3$/),
      mimeType: 'audio/mpeg',
      blob: result.blob,
      createdAt: 1781376062000
    }));
    expect(cache).toEqual(expect.objectContaining({
      assetId: 'asset-speech',
      name: 'Polaris-voice-20260614000102-abc12345.mp3',
      mimeType: 'audio/mpeg',
      size: 5,
      createdAt: 1781376062000,
      textLength: 5,
      providerType: 'openai-compatible',
      model: 'tts-1',
      voice: 'alloy',
      format: 'mp3'
    }));
    expect(cache.textHash).toMatch(/^[a-f0-9]+$/);
  });

  it('throws when the referenced cached speech asset is missing', async () => {
    assetStoreMocks.getAssetBlob.mockResolvedValue(null);
    const { readMessageSpeechCacheBlob } = await import('./messageSpeechCache');

    await expect(readMessageSpeechCacheBlob({
      assetId: 'missing',
      name: 'voice.mp3',
      mimeType: 'audio/mpeg',
      size: 1,
      createdAt: 1,
      textHash: 'hash',
      textLength: 1,
      providerType: 'openai-compatible',
      model: 'tts-1',
      voice: 'alloy',
      format: 'mp3'
    })).rejects.toThrow('语音缓存文件');
  });
});

describe('messageSpeechCacheMatchesText', () => {
  const settings: VoiceGenerationSettings = {
    enabled: true,
    providerType: 'fishaudio',
    baseUrl: 'https://api.fish.audio',
    model: 's1',
    voice: 'voice-a',
    format: 'mp3'
  };
  const result: VoiceGenerationResult = {
    blob: new Blob(['audio'], { type: 'audio/mpeg' }),
    mimeType: 'audio/mpeg',
    model: 's1',
    voice: 'voice-a',
    format: 'mp3'
  };

  async function cachedClip(text: string, overrides: Partial<VoiceGenerationSettings> = {}) {
    assetStoreMocks.saveAsset.mockResolvedValue({
      id: 'asset-speech',
      kind: 'file',
      name: 'voice.mp3',
      mimeType: 'audio/mpeg',
      size: 5,
      createdAt: 1
    });
    const { saveMessageSpeechCache } = await import('./messageSpeechCache');
    return saveMessageSpeechCache({ text, settings: { ...settings, ...overrides }, result });
  }

  it('matches the text it was generated from and rejects a different one', async () => {
    const { messageSpeechCacheMatchesText } = await import('./messageSpeechCache');
    const cache = await cachedClip('你好呀');
    expect(await messageSpeechCacheMatchesText(cache, '你好呀')).toBe(true);
    expect(await messageSpeechCacheMatchesText(cache, '你好呀', settings)).toBe(true);
    expect(await messageSpeechCacheMatchesText(cache, '再见啦')).toBe(false);
  });

  it('rejects a clip made with another voice, provider or model', async () => {
    const { messageSpeechCacheMatchesText } = await import('./messageSpeechCache');
    const cache = await cachedClip('你好呀');
    expect(await messageSpeechCacheMatchesText(cache, '你好呀', { ...settings, voice: 'voice-b' })).toBe(false);
    expect(await messageSpeechCacheMatchesText(cache, '你好呀', { ...settings, providerType: 'minimax' })).toBe(false);
    expect(await messageSpeechCacheMatchesText(cache, '你好呀', { ...settings, model: 's2' })).toBe(false);
  });

  it('treats a blank voice or model as the provider default', async () => {
    const { messageSpeechCacheMatchesText } = await import('./messageSpeechCache');
    const cache = await cachedClip('你好呀');
    expect(await messageSpeechCacheMatchesText(cache, '你好呀', { ...settings, voice: '' })).toBe(true);
    expect(await messageSpeechCacheMatchesText(cache, '你好呀', { ...settings, model: '' })).toBe(true);
  });

  it('rejects empty caches and empty text', async () => {
    const { messageSpeechCacheMatchesText } = await import('./messageSpeechCache');
    const cache = await cachedClip('你好呀');
    expect(await messageSpeechCacheMatchesText(null, '你好呀', settings)).toBe(false);
    expect(await messageSpeechCacheMatchesText(cache, '   ', settings)).toBe(false);
  });
});
