import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { readMessageSpeechCacheBlob } from '../../../app/chat/messageSpeechCache';
import {
  getCallAudio,
  markCallAudioBlocked,
  markCallAudioUnlocked,
  primeCallAudio,
  setCallAudioInUse
} from '../../../app/call/callAudio';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import { runSelectionAction } from '../../haptics';
import { useChatPresentation, useChatStablePayload } from '../chat/context/ChatContext';
import { useFleshAmbience } from '../../../app/call/useFleshAmbience';
import { buildReadingBlocks, resolveReadingCursor, type ReadingBlock } from './chatReadingModel';

type ChatReadingStageProps = {
  onClose: () => void;
};

export function ChatReadingStage({ onClose }: ChatReadingStageProps) {
  const { t } = useI18n();
  const stablePayload = useChatStablePayload();
  const presentation = useChatPresentation();

  const ambience = useFleshAmbience();
  const blocks = useMemo(() => buildReadingBlocks(stablePayload.messages), [stablePayload.messages]);
  const spokenBlocks = useMemo(() => blocks.filter((block) => block.voicable), [blocks]);

  const [playing, setPlaying] = useState(false);
  const [spokenIndex, setSpokenIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState('');
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const blockElementsRef = useRef(new Map<string, HTMLElement>());

  useEffect(() => () => {
    runIdRef.current += 1;
    setCallAudioInUse(false);
    ambience.stop();
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!activeMessageId) return;
    blockElementsRef.current.get(activeMessageId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeMessageId]);

  const releaseAudio = () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setCallAudioInUse(false);
    ambience.stop();
    const audio = audioRef.current;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audioRef.current = null;
  };

  const stopPlayback = () => {
    runIdRef.current += 1;
    releaseAudio();
    setPlaying(false);
    setProgress(0);
    setActiveMessageId(null);
  };

  const playAt = (index: number) => {
    const block = spokenBlocks[index];
    const cache = block?.voiceCache ?? null;
    if (!block || !cache) {
      stopPlayback();
      return;
    }
    runIdRef.current += 1;
    const runId = runIdRef.current;
    releaseAudio();
    setNotice('');
    setProgress(0);
    setSpokenIndex(index);
    setActiveMessageId(block.messageId);

    const interrupt = (message: string) => {
      if (runIdRef.current !== runId) return;
      releaseAudio();
      setPlaying(false);
      setProgress(0);
      setNotice(message);
    };

    void (async () => {
      let blob: Blob;
      try {
        blob = await readMessageSpeechCacheBlob(cache);
      } catch {
        interrupt(t('chat.reading.speechMissing'));
        return;
      }
      if (runIdRef.current !== runId) return;

      // Every clip rides the one element a real tap already unlocked: a phone browser
      // will not start sound on an element it has never heard inside a gesture.
      const url = URL.createObjectURL(blob);
      const audio = getCallAudio();
      setCallAudioInUse(true);
      audioRef.current = audio;
      audio.preload = 'auto';
      audio.onended = null;
      audio.onerror = null;
      audio.src = url;

      const tick = () => {
        if (runIdRef.current !== runId) return;
        const duration = audio.duration;
        setProgress(Number.isFinite(duration) && duration > 0 ? Math.min(1, audio.currentTime / duration) : 0);
        frameRef.current = window.requestAnimationFrame(tick);
      };

      audio.onended = () => {
        if (runIdRef.current !== runId) return;
        audio.onended = null;
        audio.onerror = null;
        audioRef.current = null;
        URL.revokeObjectURL(url);
        if (index + 1 < spokenBlocks.length) playAt(index + 1);
        else stopPlayback();
      };
      audio.onerror = () => {
        if (runIdRef.current !== runId) return;
        URL.revokeObjectURL(url);
        interrupt(t('chat.reading.speechFailed'));
      };

      try {
        await audio.play();
      } catch {
        URL.revokeObjectURL(url);
        markCallAudioBlocked();
        interrupt(t('chat.reading.tapToPlay'));
        return;
      }
      if (runIdRef.current !== runId) return;
      markCallAudioUnlocked();
      setPlaying(true);
      if (block.ambience.length) {
        const measured = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : block.ambienceSec;
        ambience.schedule(block.ambience, measured);
        ambience.setDucked(true);
      } else {
        ambience.stop();
      }
      frameRef.current = window.requestAnimationFrame(tick);
    })();
  };

  const togglePlay = () => {
    if (playing) {
      stopPlayback();
      return;
    }
    primeCallAudio();
    ambience.schedule([], 1);
    playAt(spokenIndex >= 0 && spokenIndex < spokenBlocks.length ? spokenIndex : 0);
  };

  const step = (delta: number) => {
    if (spokenBlocks.length === 0) return;
    primeCallAudio();
    ambience.schedule([], 1);
    const base = spokenIndex >= 0 ? spokenIndex : 0;
    const next = Math.min(spokenBlocks.length - 1, Math.max(0, base + delta));
    playAt(next);
  };

  const close = () => {
    stopPlayback();
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      stopPlayback();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  const renderSegments = (block: ReadingBlock) => {
    const cursor = block.messageId === activeMessageId
      ? resolveReadingCursor(block.segments, progress)
      : { segmentIndex: -1, readChars: 0 };
    return block.segments.map((segment, index) => {
      const state = cursor.segmentIndex < 0 || segment.kind === 'stage'
        ? 'idle'
        : index < cursor.segmentIndex
          ? 'read'
          : index === cursor.segmentIndex
            ? 'active'
            : 'idle';
      const className = [
        'chat-reading-seg',
        segment.kind === 'stage' ? 'is-stage' : 'is-speech',
        state === 'idle' ? '' : 'is-' + state
      ].filter(Boolean).join(' ');
      const chars = Array.from(segment.text);
      if (state === 'active' && cursor.readChars > 0 && cursor.readChars < chars.length) {
        return (
          <span key={index} className={className}>
            <span className="chat-reading-read">{chars.slice(0, cursor.readChars).join('')}</span>
            {chars.slice(cursor.readChars).join('')}
          </span>
        );
      }
      return <span key={index} className={className}>{segment.text}</span>;
    });
  };

  const hasVoice = spokenBlocks.length > 0;
  const metaText = hasVoice
    ? t('chat.reading.progress', { index: Math.max(1, spokenIndex + 1), total: spokenBlocks.length })
    : t('chat.reading.noVoice');

  return createPortal(
    <div
      className="chat-reading-stage"
      role="dialog"
      aria-modal="true"
      aria-label={t('chat.reading.title')}
      style={{ '--reading-accent': presentation.personaColor } as CSSProperties}
    >
      <div className="chat-reading-stage-inner">
        <div className="chat-reading-head">
          <div className="chat-reading-head-copy">
            <p className="chat-reading-head-title">{t('chat.reading.title')}</p>
            <p className="chat-reading-head-meta">{metaText}</p>
          </div>
          <span className="chat-reading-head-spacer" />
          <button
            type="button"
            className="chat-reading-control"
            disabled={!hasVoice}
            aria-label={t('chat.reading.prev')}
            title={t('chat.reading.prev')}
            onClick={(event) => runSelectionAction(() => step(-1), { element: event.currentTarget })}
          >
            <Icon name="chevronUp" size={14} />
          </button>
          <button
            type="button"
            className="chat-reading-control is-primary"
            disabled={!hasVoice}
            aria-label={playing ? t('chat.reading.pause') : t('chat.reading.play')}
            title={playing ? t('chat.reading.pause') : t('chat.reading.play')}
            onClick={(event) => runSelectionAction(togglePlay, { element: event.currentTarget })}
          >
            <Icon name={playing ? 'pause' : 'play'} size={15} />
            <span>{playing ? t('chat.reading.pause') : t('chat.reading.play')}</span>
          </button>
          <button
            type="button"
            className="chat-reading-control"
            disabled={!hasVoice}
            aria-label={t('chat.reading.next')}
            title={t('chat.reading.next')}
            onClick={(event) => runSelectionAction(() => step(1), { element: event.currentTarget })}
          >
            <Icon name="chevronDown" size={14} />
          </button>
          <button
            type="button"
            className="chat-reading-control"
            aria-label={t('chat.reading.close')}
            title={t('chat.reading.close')}
            onClick={(event) => runSelectionAction(close, { element: event.currentTarget })}
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        {notice ? <p className="chat-reading-notice">{notice}</p> : null}

        <div className="chat-reading-scroll">
          {blocks.length === 0 ? <p className="chat-reading-empty">{t('chat.reading.empty')}</p> : null}
          {blocks.map((block) => (
            <article
              key={block.messageId}
              className={'chat-reading-block ' + (block.role === 'user' ? 'is-user ' : '') + (block.messageId === activeMessageId ? 'is-active' : '')}
              ref={(element) => {
                if (element) blockElementsRef.current.set(block.messageId, element);
                else blockElementsRef.current.delete(block.messageId);
              }}
            >
              <p className="chat-reading-speaker">
                {block.role === 'assistant' ? presentation.assistantName : t('chat.reading.you')}
              </p>
              <p className="chat-reading-text">{renderSegments(block)}</p>
            </article>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}