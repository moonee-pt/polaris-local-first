import { useMemo } from 'react';
import { resolveVoiceSettingsForVoiceId } from '../../engines/voice/personaVoice';
import { usePersonaStore } from '../../stores/personaStore';
import { useRuntimeStore } from '../../stores/runtimeStore';
import type { VoiceGenerationSettings } from '../../types/domain';

/** The voice settings that belong to whoever is speaking, falling back to the global ones. */
export function useVoiceSettingsForSpeaker(speakerCollaboratorId?: string | null): VoiceGenerationSettings {
  const voiceGeneration = useRuntimeStore((state) => state.voiceGeneration);
  const activeCollaboratorId = usePersonaStore((state) => state.activeCollaboratorId);
  const resolvedSpeakerId = speakerCollaboratorId?.trim() || activeCollaboratorId;
  const speakerVoiceId = usePersonaStore((state) => (
    resolvedSpeakerId
      ? state.personas.find((persona) => persona.id === resolvedSpeakerId)?.advanced.speechVoiceId ?? ''
      : ''
  ));

  return useMemo(
    () => resolveVoiceSettingsForVoiceId(voiceGeneration, speakerVoiceId),
    [voiceGeneration, speakerVoiceId]
  );
}