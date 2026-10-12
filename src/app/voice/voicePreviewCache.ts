import type { VoiceGenerationSettings } from '../../types/domain';

const PREVIEW_CACHE_LIMIT = 24;

/**
 * Auditioning a list of voices means the same sentence is asked for again and again.
 * The clips are kept for this session so a second tap plays instantly; a reload simply
 * synthesises the sentence once more.
 */
const previewBlobs = new Map<string, Blob>();

export function buildVoicePreviewCacheKey(settings: VoiceGenerationSettings): string {
  return [
    settings.providerType ?? 'openai-compatible',
    (settings.baseUrl ?? '').trim(),
    (settings.path ?? '').trim(),
    (settings.model ?? settings.modelOverride ?? '').trim(),
    (settings.voice ?? '').trim(),
    settings.format ?? 'mp3'
  ].join('|');
}

export function readVoicePreviewBlob(settings: VoiceGenerationSettings): Blob | null {
  return previewBlobs.get(buildVoicePreviewCacheKey(settings)) ?? null;
}

export function writeVoicePreviewBlob(settings: VoiceGenerationSettings, blob: Blob): void {
  const key = buildVoicePreviewCacheKey(settings);
  previewBlobs.delete(key);
  previewBlobs.set(key, blob);
  while (previewBlobs.size > PREVIEW_CACHE_LIMIT) {
    const oldest = previewBlobs.keys().next();
    if (oldest.done) break;
    previewBlobs.delete(oldest.value);
  }
}