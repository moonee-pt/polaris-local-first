const fs = require('fs');

function edit(path, edits) {
  const raw = fs.readFileSync(path, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  let text = raw.split('\r\n').join('\n');
  for (const [label, find, replace, expected] of edits) {
    const want = expected === undefined ? 1 : expected;
    const count = text.split(find).length - 1;
    if (count !== want) throw new Error(`${path} [${label}]: matched ${count}, expected ${want}`);
    text = text.split(find).join(replace);
  }
  fs.writeFileSync(path, text.split('\n').join(eol), 'utf8');
  console.log('ok', path);
}

edit('src/types/domain/persona.ts', [
  ['type', '  regexTriggers?: string;\n', '  regexTriggers?: string;\n  voiceStylePrompt?: string;\n']
]);

edit('src/config/persona/personaBuilder.ts', [
  ['defaults', "      regexTriggers: overrides.advanced?.regexTriggers ?? '',\n", "      regexTriggers: overrides.advanced?.regexTriggers ?? '',\n      voiceStylePrompt: overrides.advanced?.voiceStylePrompt ?? '',\n"]
]);

edit('src/engines/request/requestAudit.ts', [
  ['name', "  | 'speech_cue_instruction'\n", "  | 'speech_cue_instruction'\n  | 'voice_style_prompt'\n"]
]);

edit('src/engines/request/requestPromptLayers.ts', [
  ['params', '  regexTriggers?: string;\n', '  regexTriggers?: string;\n  voiceStylePrompt?: string;\n', 2],
  [
    'destructure',
    'const { personaPrompt, personaPromptSource, templateContext, messages, regexTriggers, currentTask,',
    'const { personaPrompt, personaPromptSource, templateContext, messages, regexTriggers, voiceStylePrompt, currentTask,'
  ],
  [
    'entry',
    '  const workRuntimeEntry = buildWorkRuntimeEntry({ currentTask, messages, toolContext });\n',
    "  const voiceStyleEntry = {\n"
      + "    name: 'voice_style_prompt' as const,\n"
      + "    label: '语音风格',\n"
      + "    role: 'system' as const,\n"
      + "    layer: 'context' as const,\n"
      + "    truncationPriority: 56,\n"
      + "    content: voiceStylePrompt?.trim() ?? '',\n"
      + "    enabled: false,\n"
      + "    charCount: 0\n"
      + "  };\n"
      + '  const workRuntimeEntry = buildWorkRuntimeEntry({ currentTask, messages, toolContext });\n'
  ],
  [
    'order',
    '    modeInstructionEntry,\n    ...(runtimeClockEntry ? [runtimeClockEntry] : []),',
    '    modeInstructionEntry,\n    voiceStyleEntry,\n    ...(runtimeClockEntry ? [runtimeClockEntry] : []),'
  ]
]);

edit('src/engines/request/requestPreparation.ts', [
  [
    'pass',
    '    regexTriggers: preparedAdvanced?.regexTriggers,\n',
    '    regexTriggers: preparedAdvanced?.regexTriggers,\n    voiceStylePrompt: preparedAdvanced?.voiceStylePrompt,\n'
  ]
]);

edit('src/ui/shell/persona/settings/PromptSettingsTab.tsx', [
  ['import', "import { SnippetsSettingsTab } from './SnippetsSettingsTab';\n", "import { SnippetsSettingsTab } from './SnippetsSettingsTab';\nimport { VoiceStylePromptField } from './VoiceStylePromptField';\n"],
  ['pagename', "type PromptSettingsPage = 'prompt' | 'message' | 'tone' | 'rules';", "type PromptSettingsPage = 'prompt' | 'message' | 'tone' | 'rules' | 'voice';"],
  ['meta', "  rules: { label: '世界书', icon: 'promptRules' }\n};", "  rules: { label: '世界书', icon: 'promptRules' },\n  voice: { label: '语音', icon: 'voice' }\n};"],
  ['pages', "const PROMPT_PAGES: PromptSettingsPage[] = ['prompt', 'message', 'tone', 'rules'];", "const PROMPT_PAGES: PromptSettingsPage[] = ['prompt', 'message', 'tone', 'rules', 'voice'];"],
  [
    'render',
    "        visibleSections=\"worldBook\"\n        />\n      ) : null}\n",
    "        visibleSections=\"worldBook\"\n        />\n      ) : null}\n\n      {activePromptPage === 'voice' ? (\n        <VoiceStylePromptField\n          activeCollaboratorId={activeCollaboratorId}\n          activePersona={activePersona}\n          onUpdatePersona={onUpdatePersona}\n        />\n      ) : null}\n"
  ]
]);

edit('src/styles/sheets/sheet-persona-studio.css', [
  [
    'css',
    '.ps-rx-paste-confirm:disabled { opacity: 0.42; cursor: not-allowed; }\n',
    '.ps-rx-paste-confirm:disabled { opacity: 0.42; cursor: not-allowed; }\n'
      + '.ps-rx-paste-buttons { display: flex; align-items: center; gap: 8px; }\n'
      + '.ps-rx-paste-clear { padding: 8px 12px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--border) 90%, transparent); background: transparent; color: var(--text-muted); font-family: inherit; font-size: var(--type-small); cursor: pointer; flex-shrink: 0; transition: all 0.15s ease; }\n'
      + '.ps-rx-paste-clear:hover:not(:disabled) { border-color: color-mix(in srgb, var(--border-hover) 88%, transparent); color: var(--text-soft); }\n'
      + '.ps-rx-paste-clear:disabled { opacity: 0.42; cursor: not-allowed; }\n'
  ]
]);

const component = `import { useEffect, useState } from 'react';
import { type PersonaTabProps } from '../personaUiShared';

export function VoiceStylePromptField({
  activeCollaboratorId,
  activePersona,
  onUpdatePersona
}: PersonaTabProps) {
  const storedPrompt = activePersona?.advanced.voiceStylePrompt ?? '';
  const [draft, setDraft] = useState(storedPrompt);

  useEffect(() => {
    setDraft(activePersona?.advanced.voiceStylePrompt ?? '');
  }, [activeCollaboratorId]);

  const trimmedDraft = draft.trim();
  const trimmedStored = storedPrompt.trim();
  const dirty = trimmedDraft !== trimmedStored;

  const save = () => {
    if (!dirty) return;
    onUpdatePersona({ advanced: { voiceStylePrompt: trimmedDraft } });
  };

  const clear = () => {
    setDraft('');
    if (trimmedStored) {
      onUpdatePersona({ advanced: { voiceStylePrompt: '' } });
    }
  };

  return (
    <div className="ps-field prompt-settings-field">
      <div className="ps-field-head ps-field-head--meta-right">
        <span className="ps-field-label">语音风格提示词</span>
        <span className="ps-field-hint">{trimmedStored ? '已生效 · 每轮都按它说话' : '未填写 · 写清说话的样子'}</span>
      </div>

      <div className="ps-rx-paste">
        <textarea
          className="ps-rx-input ps-rx-paste-area"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={6}
          aria-label="语音风格提示词"
          placeholder={'写清这个角色说话的样子：音色、语速、口头禅、情绪习惯、称呼……\\n例：语速偏慢，尾音上挑；高兴时句尾拖长音，生气时句子变短。'}
        />
        <div className="ps-rx-paste-actions">
          <span className="ps-rx-field-label">{dirty ? '还没保存' : '已保存'}</span>
          <div className="ps-rx-paste-buttons">
            <button type="button" className="ps-rx-paste-clear" onClick={clear} disabled={!draft}>
              清空
            </button>
            <button type="button" className="ps-rx-paste-confirm" onClick={save} disabled={!dirty}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/ui/shell/persona/settings/VoiceStylePromptField.tsx', component.split('\n').join('\r\n'), 'utf8');
console.log('ok src/ui/shell/persona/settings/VoiceStylePromptField.tsx');