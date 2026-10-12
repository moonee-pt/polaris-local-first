import { useEffect, useRef, useState } from 'react';
import { createUid } from '../../../../engines/id';
import { requestGeneratedSpeech } from '../../../../engines/voiceGenerationClient';
import { resolveVoiceSettingsForVoiceId } from '../../../../engines/voice/personaVoice';
import { readVoicePreviewBlob, writeVoicePreviewBlob } from '../../../../app/voice/voicePreviewCache';
import { useRuntimeStore } from '../../../../stores/runtimeStore';
import { Icon } from '../../../Icon';
import { type PersonaTabProps } from '../personaUiShared';
import type { VoiceGenerationCustomVoice, VoiceGenerationProviderType, VoiceGenerationSettings } from '../../../../types/domain';

const FOLLOW_GLOBAL_VALUE = '';

function resolveProviderType(settings: VoiceGenerationSettings): VoiceGenerationProviderType {
  if (settings.providerType === 'minimax') return 'minimax';
  if (settings.providerType === 'elevenlabs') return 'elevenlabs';
  if (settings.providerType === 'fishaudio') return 'fishaudio';
  return 'openai-compatible';
}

/** How this character sounds: pick from the saved voices, or add one on the spot. */
export function VoiceSelectField({ activeCollaboratorId, activePersona, onUpdatePersona }: PersonaTabProps) {
  const voiceGeneration = useRuntimeStore((state) => state.voiceGeneration);
  const setVoiceGeneration = useRuntimeStore((state) => state.setVoiceGeneration);
  const providerType = resolveProviderType(voiceGeneration);
  const voices = (voiceGeneration.customVoices ?? []).filter((voice) => voice.providerType === providerType);
  const storedId = activePersona?.advanced.speechVoiceId?.trim() ?? '';
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftId, setDraftId] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
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
    setPreviewPlaying(false);
    setPreviewLoading(false);
  };

  useEffect(() => {
    stopPreview();
    setAdding(false);
    setDraftName('');
    setDraftId('');
    setPreviewStatus('');
  }, [activeCollaboratorId]);

  useEffect(() => stopPreview, []);

  const knownIds = new Set(voices.map((voice) => voice.voice));
  const selectValue = storedId && knownIds.has(storedId) ? storedId : storedId ? '__custom__' : FOLLOW_GLOBAL_VALUE;

  const playPreview = async () => {
    if (previewPlaying || previewLoading) {
      stopPreview();
      setPreviewStatus('');
      return;
    }
    stopPreview();
    const settings = resolveVoiceSettingsForVoiceId(voiceGeneration, storedId);
    if (!settings.baseUrl?.trim() || !settings.apiKey?.trim()) {
      setPreviewStatus('先填好语音的 Base URL 和 API Key。');
      return;
    }
    const playBlob = async (blob: Blob) => {
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audioUrlRef.current = audioUrl;
      audio.onended = () => {
        stopPreview();
        setPreviewStatus('试听完成。');
      };
      audio.onerror = () => {
        stopPreview();
        setPreviewStatus('试听失败。');
      };
      setPreviewPlaying(true);
      setPreviewStatus('正在播放试听。');
      await audio.play();
    };
    const cached = readVoicePreviewBlob(settings);
    if (cached) {
      try {
        await playBlob(cached);
      } catch {
        stopPreview();
        setPreviewStatus('试听失败。');
      }
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPreviewLoading(true);
    setPreviewStatus('正在生成试听音频。');
    try {
      const result = await requestGeneratedSpeech({
        settings,
        text: '你好，亲爱的用户，欢迎你跟我聊天。',
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      writeVoicePreviewBlob(settings, result.blob);
      setPreviewLoading(false);
      await playBlob(result.blob);
    } catch (error) {
      if (controller.signal.aborted) return;
      stopPreview();
      setPreviewStatus(error instanceof Error ? error.message : '试听失败。');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const saveNewVoice = () => {
    const id = draftId.trim();
    if (!id) return;
    const entry: VoiceGenerationCustomVoice = {
      id: createUid('voice'),
      providerType,
      label: draftName.trim(),
      voice: id,
      source: 'manual',
      createdAt: Date.now()
    };
    setVoiceGeneration({ customVoices: [...(voiceGeneration.customVoices ?? []), entry] });
    onUpdatePersona({ advanced: { speechVoiceId: id } });
    setAdding(false);
    setDraftName('');
    setDraftId('');
  };

  return (
    <div className="ps-field voice-persona-field">
      <div className="ps-field-head">
        <span className="ps-field-label">朗读音色</span>
      </div>
      <div className="voice-setting-row">
        <select
          value={selectValue}
          aria-label="朗读音色"
          onChange={(event) => {
            const next = event.target.value;
            onUpdatePersona({ advanced: { speechVoiceId: next === '__custom__' ? storedId : next } });
          }}
        >
          <option value={FOLLOW_GLOBAL_VALUE}>跟随全局音色</option>
          {voices.map((voice) => (
            <option key={voice.id} value={voice.voice}>
              {voice.label.trim() || voice.voice}
            </option>
          ))}
          {selectValue === '__custom__' ? (
            <option value="__custom__">{`当前：${storedId}`}</option>
          ) : null}
        </select>
        <button
          type="button"
          className="btn-secondary compact voice-preview-button"
          onClick={() => void playPreview()}
          aria-label="试听"
          title="试听"
        >
          <Icon name={previewPlaying || previewLoading ? 'pause' : 'play'} size={14} />
          <span>{previewLoading ? '生成中' : previewPlaying ? '停止' : '试听'}</span>
        </button>
      </div>
      {previewStatus ? <p className="voice-preview-status">{previewStatus}</p> : null}

      {adding ? (
        <div className="voice-library-row">
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="名称，例如 低沉男声"
            aria-label="音色名称"
          />
          <input
            value={draftId}
            onChange={(event) => setDraftId(event.target.value)}
            placeholder="填音色 id"
            aria-label="音色 id"
          />
          <button type="button" className="btn-secondary compact" onClick={saveNewVoice} disabled={!draftId.trim()}>
            保存
          </button>
          <button
            type="button"
            className="voice-library-remove"
            onClick={() => {
              setAdding(false);
              setDraftName('');
              setDraftId('');
            }}
            aria-label="取消新增"
            title="取消"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ) : (
        <button type="button" className="btn-secondary compact voice-library-add" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14} />
          <span>新增一条</span>
        </button>
      )}
    </div>
  );
}