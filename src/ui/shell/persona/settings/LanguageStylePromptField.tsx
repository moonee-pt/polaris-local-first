import { useEffect, useRef, useState } from 'react';
import { type PersonaTabProps } from '../personaUiShared';

type LanguageStylePromptFieldProps = PersonaTabProps & {
  expandedUsesPageScroll?: boolean;
};

export function LanguageStylePromptField({
  activeCollaboratorId,
  activePersona,
  onUpdatePersona,
  expandedUsesPageScroll = false
}: LanguageStylePromptFieldProps) {
  const storedPrompt = activePersona?.advanced.languageStylePrompt ?? '';
  const [draft, setDraft] = useState(storedPrompt);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const promptFieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(activePersona?.advanced.languageStylePrompt ?? '');
  }, [activeCollaboratorId]);

  useEffect(() => {
    if (!promptExpanded) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPromptExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [promptExpanded]);

  useEffect(() => {
    if (!promptExpanded) return;
    promptFieldRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [promptExpanded]);

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
    <div
      ref={promptFieldRef}
      className={`ps-field prompt-settings-field ps-field--prompt-editor ${promptExpanded ? 'ps-field--expanded' : ''}`}
    >
      <div className="ps-field-head ps-field-head--inline-action">
        <span className="ps-field-label">语言风格提示词</span>
        <button
          type="button"
          className="ps-field-expand-btn"
          onClick={() => setPromptExpanded((current) => !current)}
        >
          {promptExpanded ? '收起' : '展开'}
        </button>
      </div>
      <textarea
        className={`ps-textarea ps-textarea--mono ps-textarea--prompt ps-textarea--prompt-editor ${promptExpanded ? 'ps-textarea--expanded-inline' : ''} ${promptExpanded && expandedUsesPageScroll ? 'ps-textarea--expanded-page-scroll' : ''}`}
        rows={promptExpanded ? 18 : 10}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-label="语言风格提示词"
        placeholder={'写清输出该是什么样子：句子长短、用词习惯、口语还是书面、怎么称呼对方、要不要写动作旁白……'}
        autoFocus={promptExpanded}
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
  );
}
