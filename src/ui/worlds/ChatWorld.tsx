import type { ComponentProps, DragEvent } from 'react';
import { Suspense, lazy, useEffect, useRef } from 'react';
import { stopAllAmbiences } from '../../app/audio/ambienceRegistry';
import { useVoiceCallSession } from '../../app/call/voiceCallSession';
import { useReadingSession } from '../../app/reading/readingSession';
import { loadThinkingSheetModule } from '../app-shell/appShellLazyModules';
import { CollaboratorScopeStrip } from '../collection/grid/CollaboratorScopeStrip';
import { VoiceCallStage } from './call/VoiceCallStage';
import { ChatReadingStage } from './reading/ChatReadingStage';
import { ChatComposer } from './chat/composer/ChatComposer';
import { ComposerOptionBar } from './chat/composer/ComposerOptionBar';
import { useComposerFileIngest } from './chat/composer/useComposerFileIngest';
import { ChatProvider } from './chat/ChatProvider';
import { MessageTimeline } from './chat/timeline/MessageTimeline';
import {
  useChatActions,
  useChatComposer,
  useChatPresentation,
  useChatStablePayload,
  useChatUi
} from './chat/context/ChatContext';
import type { ChatUiState } from './chat/context/ChatUiState';

const ThinkingSheet = lazy(() => loadThinkingSheetModule().then((module) => ({ default: module.ThinkingSheet })));

type ChatWorldProps = {
  shell: {
    isActiveWorld: boolean;
    isWorldSwitching: boolean;
    openToolbox: () => void;
    openProviderSettings: () => void;
  };
  scopeDrawer: ComponentProps<typeof CollaboratorScopeStrip>;
  ui: ChatUiState;
};

function ChatWorldLayout({ shell }: ChatWorldProps) {
  const stablePayload = useChatStablePayload();
  const presentation = useChatPresentation();
  const composer = useChatComposer();
  const ui = useChatUi();
  const actions = useChatActions();
  const addComposerFiles = useComposerFileIngest();
  const dragDepthRef = useRef(0);
  const voiceCallActive = useVoiceCallSession((state) => state.active);
  const openVoiceCall = useVoiceCallSession((state) => state.open);
  const closeVoiceCall = useVoiceCallSession((state) => state.close);
  const readingOpen = useReadingSession((state) => state.active);
  const closeReading = useReadingSession((state) => state.close);

  const conversationId = stablePayload.conversation?.id ?? null;

  // 换会话或离开对话世界时，把还在延续的音效一起静音。
  useEffect(() => stopAllAmbiences, [conversationId]);

  useEffect(() => {
    if (!shell.isActiveWorld) stopAllAmbiences();
  }, [shell.isActiveWorld]);

  useEffect(() => () => {
    useVoiceCallSession.getState().close();
    useReadingSession.getState().close();
  }, []);

  const thinkingSummaryMessage = ui.thinkingSummaryMessageId
    ? stablePayload.messages.find((message) => message.id === ui.thinkingSummaryMessageId) ?? null
    : null;
  const isFileDrag = (event: DragEvent<HTMLElement>) => event.dataTransfer?.types.includes('Files') ?? false;
  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    actions.setDragActive(true);
  };
  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!composer.dragActive) actions.setDragActive(true);
  };
  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) actions.setDragActive(false);
  };
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    actions.setDragActive(false);
    const files = event.dataTransfer?.files;
    if (files?.length) {
      void addComposerFiles(files);
    }
  };

  return (
    <section
      className={`world world-chat timeline-${presentation.timelineDensity} ${composer.dragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="chat-body">
        <MessageTimeline isWorldSettled={shell.isActiveWorld && !shell.isWorldSwitching} />
      </div>
      <div className="chat-dock">
        <ComposerOptionBar />
        <ChatComposer onStartVoiceCall={openVoiceCall} />
      </div>
      {voiceCallActive ? (
        <VoiceCallStage onClose={closeVoiceCall} />
      ) : null}
      {readingOpen ? (
        <ChatReadingStage onClose={closeReading} />
      ) : null}
      {thinkingSummaryMessage ? (
        <Suspense fallback={null}>
          <ThinkingSheet
            message={thinkingSummaryMessage}
            messages={stablePayload.messages}
            assistantName={presentation.fallbackAssistantName}
            onClose={actions.closeThinkingSummary}
          />
        </Suspense>
      ) : null}
    </section>
  );
}

export function ChatWorld(props: ChatWorldProps) {
  const normalizedShell = {
    isActiveWorld: props.shell.isActiveWorld,
    isWorldSwitching: props.shell.isWorldSwitching,
    openToolbox: props.shell.openToolbox,
    openProviderSettings: props.shell.openProviderSettings
  };

  return (
    <ChatProvider shell={normalizedShell} ui={props.ui}>
      <ChatWorldLayout {...props} />
      <CollaboratorScopeStrip {...props.scopeDrawer} />
    </ChatProvider>
  );
}
