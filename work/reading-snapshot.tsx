import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import '../src/styles/tokens.css';
import '../src/styles/base.css';
import type { ChatMessage, ChatMessageVoiceCache } from '../src/types/domain';
import { saveAsset } from '../src/infrastructure/assetStore';
import { ChatContextProvider } from '../src/ui/worlds/chat/context/ChatContext';
import { ChatReadingEntry } from '../src/ui/worlds/reading/ChatReadingEntry';
import { ChatReadingStage } from '../src/ui/worlds/reading/ChatReadingStage';

const params = new URLSearchParams(location.search);
const state = params.get('state') || 'full';

function makeWav(seconds: number, freq: number) {
  const sampleRate = 8000;
  const count = Math.floor(sampleRate * seconds);
  const data = new Int16Array(count);
  for (let i = 0; i < count; i += 1) {
    data[i] = Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 7000);
  }
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (off: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(off + i, value.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + data.byteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, data.byteLength, true);
  return new Blob([header, data], { type: 'audio/wav' });
}

function voiceCache(assetId: string, seconds: number): ChatMessageVoiceCache {
  return {
    assetId,
    name: 'demo.wav',
    mimeType: 'audio/wav',
    size: 1000,
    createdAt: 1750000000000,
    textHash: 'demo',
    textLength: seconds,
    providerType: 'client',
    model: 'demo',
    voice: 'demo',
    format: 'wav'
  } as unknown as ChatMessageVoiceCache;
}

const longParagraph =
  '【今天风不大，窗子开着。】【我把桌面收拾干净，把杯子放回原处。】' +
  '\n\n（把台灯调暗，声音放轻）' +
  '【你要是困了就先睡，不用等我。】【灯我留着，等你回来再关。】' +
  '\n' +
  '【明天早上我叫你，不会让你迟到。】';

const plainMessages: ChatMessage[] = [
  { id: 'm1', role: 'user', content: '今天怎么样？', timestamp: 1750000000000 },
  { id: 'm2', role: 'assistant', content: '（把灯调暗）【今天好累。】【早点睡吧。】', timestamp: 1750000001000, voiceCache: voiceCache('demo-asset', 5) },
  { id: 'm3', role: 'user', content: '好，那你也早点休息，别忙太晚。', timestamp: 1750000002000 },
  { id: 'm4', role: 'assistant', content: longParagraph, timestamp: 1750000003000 },
  { id: 'm5', role: 'assistant', content: '【晚安。】【明天见。】', timestamp: 1750000004000, voiceCache: voiceCache('demo-asset', 5) }
];

const presentation = {
  assistantName: '小助手',
  fallbackAssistantName: '小助手',
  personaColor: '#6d7f95',
  conversationTitle: '夜深了',
  isActiveWorld: true,
  recentConversations: [],
  workspaceTitleById: {},
  activeConversationId: 'demo-conversation',
  activeCollaboratorId: 'demo-persona',
  showChatAvatars: true,
  personas: [],
  startupReady: true,
  interactionLocked: false,
  hasUnsupportedPendingImages: false,
  timelineDensity: 'light',
  activeConversationBodyStatus: null
};

function buildValue(messages: ChatMessage[]) {
  return {
    conversation: { id: 'demo-conversation', title: '夜深了', collaboratorId: 'demo-persona' },
    messages,
    persona: { id: 'demo-persona', name: '小助手' },
    presentation,
    composer: {},
    ui: {},
    attachments: {},
    actions: {}
  } as unknown as Parameters<typeof ChatContextProvider>[0]['value'];
}

function ChainApp() {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  useEffect(() => {
    void (async () => {
      const ids: string[] = [];
      for (let index = 0; index < 3; index += 1) {
        const meta = await saveAsset({
          kind: 'file',
          name: 'chain-' + index + '.wav',
          mimeType: 'audio/wav',
          blob: makeWav(1.4, 420 + index * 80),
          createdAt: Date.now()
        });
        ids.push(meta.id);
      }
      const badIndex = params.get('bad');
      if (badIndex !== null) ids[Number(badIndex)] = 'missing-' + Date.now();
      setMessages([
        { id: 'c1', role: 'user', content: '第一段提问。', timestamp: 1 },
        { id: 'c2', role: 'assistant', content: '（把灯调暗）【第一句话。】【第二句话。】[wet]', timestamp: 2, voiceCache: voiceCache(ids[0], 1.4) },
        { id: 'c3', role: 'user', content: '第二段提问。', timestamp: 3 },
        { id: 'c4', role: 'assistant', content: '【第二段回答。】', timestamp: 4, voiceCache: voiceCache(ids[1], 1.4) },
        { id: 'c5', role: 'assistant', content: '【第三段回答。】', timestamp: 5, voiceCache: voiceCache(ids[2], 1.4) }
      ]);
    })();
  }, []);
  if (!messages) return <p style={{ font: '13px sans-serif', padding: 20 }}>准备音频中…</p>;
  return (
    <ChatContextProvider value={buildValue(messages)}>
      <ChatReadingStage onClose={() => {}} />
    </ChatContextProvider>
  );
}

function App() {
  if (state === 'entry') {
    return (
      <div className="app-shell chat">
        <section className="world world-chat timeline-light">
          <div className="chat-dock">
            <ChatReadingEntry onOpen={() => {}} />
          </div>
        </section>
      </div>
    );
  }
  if (state === 'chain') return <ChainApp />;
  const messages = state === 'empty' ? [] : plainMessages;
  return (
    <ChatContextProvider value={buildValue(messages)}>
      <ChatReadingStage onClose={() => {}} />
    </ChatContextProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);