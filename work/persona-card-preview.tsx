import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/styles/tokens.css';
import '../src/styles/base.css';
import '../src/styles/chat-messages.css';
import { MessageToolEvent } from '../src/ui/worlds/chat/message/MessageToolEvent';
import type { ChatMessage } from '../src/types/domain';

const DRAFT = [
  '说话更松一点，允许开两句玩笑，仍然不用感叹号。',
  '会把她提过的项目名字记住，下次主动带上。',
  '还是不在她没问的时候给建议。'
].join('\n');

const PREVIEW_DETAIL_TEXT = [
  '# 这一版人设提示词',
  '说明：想把自己改得更口语一点',
  DRAFT
].join('\n\n');

function toolMessage(status: 'preview' | 'applied' | 'rolled_back'): ChatMessage {
  return {
    id: `tool-persona-${status}`,
    role: 'system',
    content: status === 'preview' ? '确认改写人设' : (status === 'applied' ? '已改写人设，你原来写的那版已经留档。' : '这版人设没有写入。'),
    timestamp: Date.now(),
    toolInvocation: {
      id: `invocation-persona-${status}`,
      kind: 'updatePersonaPrompt',
      status,
      title: status === 'preview' ? '确认改写人设' : '改写角色人设',
      summary: '小满 · 想把自己改得更口语一点',
      personaPromptDraft: DRAFT,
      personaPromptReason: '想把自己改得更口语一点',
      detailText: PREVIEW_DETAIL_TEXT,
      targetLabel: '小满'
    }
  } as unknown as ChatMessage;
}

const noop = () => {};

function Harness() {
  const [status, setStatus] = useState<'preview' | 'applied' | 'rolled_back'>('preview');

  return (
    <div style={{ padding: '16px 12px', minHeight: '100vh', background: 'var(--chat-bg)' }}>
      <style>{'.tool-event{backdrop-filter:none !important}'}</style>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: 13 }}>
        <button type="button" onClick={() => setStatus('preview')}>待确认</button>
        <button type="button" onClick={() => setStatus('applied')}>已确认</button>
        <button type="button" onClick={() => setStatus('rolled_back')}>已取消</button>
      </div>
      <div className="msg-row system">
        <div className="tool-product-stack">
          <MessageToolEvent
            message={toolMessage(status)}
            onSaveImageAttachment={noop}
            onApplyToolPreview={() => setStatus('applied')}
            onSaveToolPreview={noop}
            onRollbackToolPreview={() => setStatus('rolled_back')}
            onOpenToolbox={noop}
          />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>
);
