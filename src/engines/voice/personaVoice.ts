import type { VoiceGenerationSettings } from '../../types/domain';

/**
 * A character may carry its own voice id. When it does, that id replaces the shared one
 * for every clip this character speaks; an empty id means "follow the global voice".
 */
export function resolveVoiceSettingsForVoiceId(
  settings: VoiceGenerationSettings,
  voiceId?: string | null
): VoiceGenerationSettings {
  const trimmed = voiceId?.trim();
  if (!trimmed) return settings;
  if ((settings.voice ?? '').trim() === trimmed) return settings;
  return { ...settings, voice: trimmed };
}