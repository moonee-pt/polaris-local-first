import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/styles/tokens.css';
import '../src/styles/base.css';
import { PromptCoreSettingsPage } from '../src/ui/shell/persona/settings/PromptCoreSettingsPage';

const ARCHIVED = [
  '她亲手写的原版：',
  '说话简短，习惯用陈述句，很少用感叹号。',
  '聊到她的工作时会主动追问细节，但不给建议。'
].join('\n');

const CURRENT = [
  '新版本（角色自己改写的一版）：',
  '说话更松一点，允许开两句玩笑，仍然不用感叹号。',
  '会把她提过的项目名字记住，下次主动带上。'
].join('\n');

function buildPersona(overrides: Record<string, unknown> = {}) {
  return {
    id: 'persona-moon',
    name: '小满',
    userName: '阿月',
    avatar: '',
    role: 'assistant',
    prompt: '',
    tone: '',
    accent: '',
    compiledPrompt: CURRENT,
    promptBackup: { compiledPrompt: ARCHIVED, savedAt: new Date('2026-10-09T12:30:00').getTime() },
    tags: { temperament: [], interaction: [], expression: [], thinking: [], action: [] },
    color: '#f6b9c9',
    createdAt: 1,
    updatedAt: 1,
    memory: { inheritGlobal: true, excludedGlobalIds: [], personalMemories: [], referenceDocs: [] },
    deepDefinition: {
      identityHint: '', missionHint: '', conflictPriority: '', conflictReason: '',
      avoidBecoming: '', correctiveAction: '', vulnerableFirst: '', vulnerableThen: '',
      hardBoundary: '', hardBoundaryAction: ''
    },
    advanced: {
      modelOverride: '', temperature: '', topP: '', maxTokens: '', thinkingBudget: '',
      contextMessageLimit: '', showThinking: false, streaming: true, customHeaders: '',
      customBody: '', regexRules: '', snippets: []
    },
    ...overrides
  } as never;
}

function Harness() {
  const [persona, setPersona] = useState(buildPersona());
  const [lastPatch, setLastPatch] = useState('');

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <PromptCoreSettingsPage
        activeCollaboratorId={persona.id}
        activePersona={persona}
        page="prompt"
        onUpdatePersona={(patch) => {
          setLastPatch(JSON.stringify(patch, null, 2));
          setPersona((current) => ({ ...current, ...(patch as object) }) as never);
        }}
      />
      <pre style={{ marginTop: 16, fontSize: 11, whiteSpace: 'pre-wrap', color: 'var(--pink-ink)' }}>
        刚才那次改动：{lastPatch || '（还没点过）'}
      </pre>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>
);
