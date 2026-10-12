import { describe, expect, it } from 'vitest';
import type { VoiceGenerationSettings } from '../../types/domain';
import { resolveVoiceSettingsForVoiceId } from './personaVoice';

const base: VoiceGenerationSettings = {
  enabled: true,
  providerType: 'fishaudio',
  voice: 'global-voice',
  model: 's1',
  format: 'mp3'
};

describe('resolveVoiceSettingsForVoiceId', () => {
  it('keeps the shared settings when the character has no voice id', () => {
    for (const id of [undefined, null, '', '   ']) {
      expect(resolveVoiceSettingsForVoiceId(base, id)).toBe(base);
    }
  });

  it('lets the character voice id replace the shared one', () => {
    const resolved = resolveVoiceSettingsForVoiceId(base, 'character-voice');
    expect(resolved.voice).toBe('character-voice');
    expect(resolved.providerType).toBe('fishaudio');
    expect(resolved.model).toBe('s1');
    expect(base.voice).toBe('global-voice');
  });

  it('trims the character voice id and keeps the same object when it already matches', () => {
    expect(resolveVoiceSettingsForVoiceId(base, '  character-voice  ').voice).toBe('character-voice');
    expect(resolveVoiceSettingsForVoiceId(base, ' global-voice ')).toBe(base);
  });
});
