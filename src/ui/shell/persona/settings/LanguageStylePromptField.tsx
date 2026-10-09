import { useEffect, useState } from 'react';
import { type PersonaTabProps } from '../personaUiShared';

export function LanguageStylePromptField({
  activeCollaboratorId,
  activePersona,
  onUpdatePersona
}: PersonaTabProps) {
  const storedPrompt = activePersona?.advanced.languageStylePrompt ?? '';
  const [draft, setDraft] = useState(storedPrompt);

  useEffect(() => {
    setDraft(activePersona?.advanced.languageStylePrompt ?? '');
  }, [activeCollaboratorId]);

  const trimmedDraft = draft.trim();
  const trimmedStored = storedPrompt.trim();
  const dirty = trimmedDraft !== trimmedStored;

  const save = () => {
    if (!dirty) return;
    onUpdatePersona({ advanced: { languageStylePrompt: trimmedDraft } });
  };

  const clear = () => {
    setDraft('');
    if (trimmedStored) {
      onUpdatePersona({ advanced: { languageStylePrompt: '' } });
    }
  };

  return (
    <div className="ps-field prompt-settings-field">
      <div className="ps-field-head ps-field-head--meta-right">
        <span className="ps-field-label">语言风格提示词</span>
        <span className="ps-field-hint">{trimmedStored ? '已生效 · 每轮按它写' : '未填写 · 写清输出风格'}</span>
      </div>

      <div className="ps-rx-paste">
        <textarea
          className="ps-rx-input ps-rx-paste-area"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={6}
          aria-label="语言风格提示词"
          placeholder={'写清输出该是什么样子：句子长短、用词习惯、口语还是书面、怎么称呼对方、要不要写动作旁白……\n例：短句为主，少用形容词；只写对话和必要动作，不写心理分析；情绪上来时句子更短更直接。'}
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
