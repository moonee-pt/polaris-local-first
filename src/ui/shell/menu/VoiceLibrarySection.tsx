import { useEffect, useRef, useState } from 'react';
import { createUid } from '../../../engines/id';
import { requestGeneratedSpeech } from '../../../engines/voiceGenerationClient';
import { resolveVoiceSettingsForVoiceId } from '../../../engines/voice/personaVoice';
import { readVoicePreviewBlob, writeVoicePreviewBlob } from '../../../app/voice/voicePreviewCache';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import type { VoiceGenerationCustomVoice, VoiceGenerationProviderType, VoiceGenerationSettings } from '../../../types/domain';

type VoiceLibrarySectionProps = {
  voiceGeneration: VoiceGenerationSettings;
  onSetVoiceGeneration: (patch: Partial<VoiceGenerationSettings>) => void;
};

function resolveProviderType(settings: VoiceGenerationSettings): VoiceGenerationProviderType {
  if (settings.providerType === 'minimax') return 'minimax';
  if (settings.providerType === 'elevenlabs') return 'elevenlabs';
  if (settings.providerType === 'fishaudio') return 'fishaudio';
  return 'openai-compatible';
}

/**
 * Named voices for one provider: a name to recognise it by, the voice id to send, and a
 * preview that goes through the same cache as everything else so a second tap is instant.
 */
export function VoiceLibrarySection({ voiceGeneration, onSetVoiceGeneration }: VoiceLibrarySectionProps) {
  const { t } = useI18n();
  const providerType = resolveProviderType(voiceGeneration);
  const voices = (voiceGeneration.customVoices ?? []).filter((voice) => voice.providerType === providerType);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewStatus, setPreviewStatus] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stopPreview = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setPreviewingId(null);
    setPreviewLoading(false);
  };

  useEffect(() => stopPreview, []);

  const writeVoices = (next: VoiceGenerationCustomVoice[]) => {
    const others = (voiceGeneration.customVoices ?? []).filter((voice) => voice.providerType !== providerType);
    onSetVoiceGeneration({ customVoices: [...others, ...next] });
  };

  const addVoice = () => {
    writeVoices([
      ...voices,
      {
        id: createUid('voice'),
        providerType,
        label: '',
        voice: '',
        source: 'manual',
        createdAt: Date.now()
      }
    ]);
  };

  const updateVoice = (id: string, patch: Partial<VoiceGenerationCustomVoice>) => {
    writeVoices(voices.map((voice) => (
      voice.id === id ? { ...voice, ...patch, updatedAt: Date.now() } : voice
    )));
  };

  const removeVoice = (id: string) => {
    if (previewingId === id) stopPreview();
    writeVoices(voices.filter((voice) => voice.id !== id));
  };

  const playPreview = async (voice: VoiceGenerationCustomVoice) => {
    if (previewingId === voice.id) {
      stopPreview();
      setPreviewStatus('');
      return;
    }
    stopPreview();
    const settings = resolveVoiceSettingsForVoiceId(voiceGeneration, voice.voice);
    if (!settings.baseUrl?.trim() || !settings.apiKey?.trim()) {
      setPreviewStatus(t('settings.voice.previewMissingConfig'));
      return;
    }
    setPreviewingId(voice.id);
    const playBlob = async (blob: Blob) => {
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audioUrlRef.current = audioUrl;
      audio.onended = () => {
        stopPreview();
        setPreviewStatus(t('settings.voice.previewReady'));
      };
      audio.onerror = () => {
        stopPreview();
        setPreviewStatus(t('settings.voice.previewFailed'));
      };
      setPreviewStatus(t('settings.voice.previewPlaying'));
      await audio.play();
    };
    const cached = readVoicePreviewBlob(settings);
    if (cached) {
      setPreviewLoading(false);
      try {
        await playBlob(cached);
      } catch {
        stopPreview();
        setPreviewStatus(t('settings.voice.previewFailed'));
      }
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPreviewLoading(true);
    setPreviewStatus(t('settings.voice.previewLoading'));
    try {
      const result = await requestGeneratedSpeech({
        settings,
        text: t('settings.voice.previewText'),
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      writeVoicePreviewBlob(settings, result.blob);
      setPreviewLoading(false);
      await playBlob(result.blob);
    } catch (error) {
      if (controller.signal.aborted) return;
      stopPreview();
      setPreviewStatus(error instanceof Error ? error.message : t('settings.voice.previewFailed'));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  return (
    <section className="menu-section">
      <div className="menu-section-head">
        <span className="menu-section-kicker">{t('settings.voice.libraryTitle')}</span>
        <p className="menu-section-note">{t('settings.voice.libraryNote')}</p>
      </div>
      <div className="voice-library-list">
        {voices.map((voice) => (
          <div className="voice-library-row" key={voice.id}>
            <input
              className="voice-library-name"
              value={voice.label}
              onChange={(event) => updateVoice(voice.id, { label: event.target.value })}
              placeholder={t('settings.voice.libraryNamePlaceholder')}
              aria-label={t('settings.voice.libraryNamePlaceholder')}
            />
            <input
              className="voice-library-id"
              value={voice.voice}
              onChange={(event) => updateVoice(voice.id, { voice: event.target.value })}
              placeholder={t('settings.voice.libraryVoicePlaceholder')}
              aria-label={t('settings.voice.libraryVoicePlaceholder')}
            />
            <button
              type="button"
              className="btn-secondary compact voice-library-preview"
              onClick={() => void playPreview(voice)}
              disabled={previewLoading && previewingId === voice.id && previewStatus === ''}
              aria-label={t('settings.voice.previewPlay')}
              title={t('settings.voice.previewPlay')}
            >
              <Icon name={previewingId === voice.id && !previewLoading ? 'pause' : 'play'} size={14} />
              <span>{previewingId === voice.id && previewLoading ? t('settings.voice.previewLoadingShort') : t('settings.voice.previewPlay')}</span>
            </button>
            <button
              type="button"
              className="voice-library-remove"
              onClick={() => removeVoice(voice.id)}
              aria-label={t('settings.voice.libraryRemove')}
              title={t('settings.voice.libraryRemove')}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
        {!voices.length ? <p className="voice-library-empty">{t('settings.voice.libraryListEmpty')}</p> : null}
        <button type="button" className="btn-secondary compact voice-library-add" onClick={addVoice}>
          <Icon name="plus" size={14} />
          <span>{t('settings.voice.libraryAdd')}</span>
        </button>
        {previewStatus ? <p className="voice-preview-status">{previewStatus}</p> : null}
      </div>
    </section>
  );
}