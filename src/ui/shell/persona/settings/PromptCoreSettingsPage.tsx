import { useEffect, useRef, useState } from 'react';
import {
  canEditPersonaPrompt,
  isCorePersona,
  isPharosPersona,
  isProductGuidePersona
} from '../../../../engines/personaBuiltin';
import { buildTemplateContext, resolveSystemPromptVars } from '../../../../engines/templateEngine';
import { loadPharosPersonaPrompt } from '../../../../config/prompts/pharosPromptLoader';
import { PersonaToggle } from '../PersonaToggle';
import { type PersonaTabProps } from '../personaUiShared';

type PromptCoreSettingsPageProps = PersonaTabProps & {
  page: 'prompt' | 'message';
  expandedUsesPageScroll?: boolean;
};

function formatArchiveDate(savedAt: number) {
  if (!Number.isFinite(savedAt) || savedAt <= 0) return '';
  return new Date(savedAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export function PromptCoreSettingsPage({
  activePersona,
  onUpdatePersona,
  page,
  expandedUsesPageScroll = false
}: PromptCoreSettingsPageProps) {
  const promptEditable = canEditPersonaPrompt(activePersona);
  const pharosReadable = isPharosPersona(activePersona);
  const [pharosDefaultPrompt, setPharosDefaultPrompt] = useState('');
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [restoreArmed, setRestoreArmed] = useState(false);
  const promptFieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!pharosReadable) {
      setPharosDefaultPrompt('');
      return () => {
        cancelled = true;
      };
    }

    void loadPharosPersonaPrompt().then((prompt) => {
      if (!cancelled) setPharosDefaultPrompt(prompt);
    });

    return () => {
      cancelled = true;
    };
  }, [pharosReadable]);

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

  useEffect(() => {
    setPromptFocused(false);
    setArchiveExpanded(false);
    setRestoreArmed(false);
  }, [activePersona?.id]);

  if (isProductGuidePersona(activePersona)) {
    return null;
  }

  if (page === 'message') {
    return (
      <>
        <div className="prompt-settings-field">
          <PersonaToggle
            label="系统时间"
            description="开启后，每次请求会在最新消息前补充当前本地完整时间和时区。"
            checked={activePersona?.systemTimeContextEnabled === true}
            onToggle={() => onUpdatePersona({
              systemTimeContextEnabled: activePersona?.systemTimeContextEnabled !== true
            })}
          />
        </div>
        <div className="ps-field prompt-settings-field">
          <div className="ps-field-head">
            <span className="ps-field-label">消息模板</span>
            <span className="ps-field-hint">发送给模型前包装历史消息</span>
          </div>
          <input
            className="ps-input ps-input--mono"
            value={activePersona?.messageTemplate || ''}
            onChange={(e) => onUpdatePersona({ messageTemplate: e.target.value })}
            placeholder="{{ message }}"
          />
          <p className="ps-footnote">
            默认 {'{{ message }}'} 表示原样发送，一般不用改。可用变量：{'{{role}}'} {'{{message}}'} {'{{date}}'} {'{{time}}'}。
          </p>
        </div>
      </>
    );
  }

  if (!promptEditable) {
    return (
      <div className="ps-field prompt-settings-field">
        <div className="ps-field-head ps-field-head--inline-action">
          <span className="ps-field-label">角色提示词</span>
          <span className="ps-field-hint">内建人格</span>
          {pharosReadable ? (
            <button
              type="button"
              className="ps-field-expand-btn"
              onClick={() => setPromptExpanded((current) => !current)}
            >
              {promptExpanded ? '收起' : '展开'}
            </button>
          ) : null}
        </div>
        <p className="ps-footnote">
          {pharosReadable
            ? 'Pharos 是内建人格，提示词可以查看，但不能在这里编辑。'
            : isCorePersona(activePersona)
              ? '这个内建人格由内建人格链维持一致性，前台这里只展示说明，不开放编辑。'
              : '当前人格不开放前台提示词编辑。'}
        </p>
        {pharosReadable ? (
          <textarea
            className={`ps-textarea ps-textarea--mono ps-textarea--prompt ${promptExpanded ? 'ps-textarea--expanded-inline' : ''} ${promptExpanded && expandedUsesPageScroll ? 'ps-textarea--expanded-page-scroll' : ''}`}
            rows={promptExpanded ? 18 : 10}
            value={pharosDefaultPrompt}
            readOnly
            placeholder="正在读取 Pharos 提示词…"
          />
        ) : null}
      </div>
    );
  }

  const promptSource = pharosReadable && !activePersona?.compiledPrompt
    ? pharosDefaultPrompt
    : activePersona?.compiledPrompt || '';
  const promptPreviewContext = buildTemplateContext({
    modelId: activePersona?.advanced.modelOverride.trim() || '当前模型',
    modelName: activePersona?.advanced.modelOverride.trim() || '当前模型',
    assistantName: activePersona?.name || '角色',
    nickname: activePersona?.userName
  });
  const promptPreview = resolveSystemPromptVars(promptSource, promptPreviewContext);
  const promptDisplayValue = promptFocused ? promptSource : promptPreview;
  const promptBackup = activePersona?.promptBackup ?? null;
  const archivedPrompt = promptBackup?.compiledPrompt.trim() ?? '';
  const canRestoreArchivedPrompt = archivedPrompt.length > 0 && archivedPrompt !== promptSource.trim();

  return (
    <div
      ref={promptFieldRef}
      className={`ps-field prompt-settings-field ps-field--prompt-editor ${promptExpanded ? 'ps-field--expanded' : ''}`}
    >
      <div className="ps-field-head ps-field-head--inline-action">
        <span className="ps-field-label">角色提示词</span>
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
        value={promptDisplayValue}
        onFocus={() => setPromptFocused(true)}
        onBlur={() => setPromptFocused(false)}
        onChange={(e) => {
          const nextPrompt = e.target.value;
          onUpdatePersona({
            compiledPrompt: nextPrompt,
            builderManaged: false,
            generatedPromptMode: nextPrompt.trim() ? 'vnext' : 'off'
          });
        }}
        placeholder="定义 TA 的核心人格、行为边界…"
        autoFocus={promptExpanded}
      />
      <p className="ps-footnote">
        支持变量：{'{cur_date}'} {'{cur_time}'} {'{cur_datetime}'} {'{assistant_name}'} {'{user_name}'} {'{nickname}'} {'{model_id}'} {'{model_name}'} {'{locale}'} {'{timezone}'} {'{system_version}'} {'{device_info}'} {'{battery_level}'}，也支持双花括号写法 {'{{char}}'} {'{{char_name}}'} {'{{user}}'}。未编辑时会按当前称呼显示，编辑时保留变量原文。{promptExpanded ? ' 按 Esc 也可以收起。' : ''}
      </p>
      {promptBackup ? (
        <>
          <p className="ps-footnote">
            TA 第一次改写前的原版已留档（{formatArchiveDate(promptBackup.savedAt)}），随时可以看或换回去。
          </p>
          {archiveExpanded ? (
            <textarea
              className="ps-textarea ps-textarea--mono ps-textarea--prompt"
              rows={10}
              value={promptBackup.compiledPrompt}
              readOnly
              aria-label="留档的原版提示词"
            />
          ) : null}
          <div className="ps-rx-paste-actions">
            <span className="ps-rx-field-label">{canRestoreArchivedPrompt ? '和现在这一版不同' : '现在就是这一版'}</span>
            <div className="ps-rx-paste-buttons">
              <button
                type="button"
                className="ps-rx-paste-clear"
                onClick={() => setArchiveExpanded((current) => !current)}
              >
                {archiveExpanded ? '收起原版' : '查看原版'}
              </button>
              <button
                type="button"
                className="ps-rx-paste-confirm"
                disabled={!canRestoreArchivedPrompt}
                onClick={() => {
                  if (!restoreArmed) {
                    setRestoreArmed(true);
                    return;
                  }
                  setRestoreArmed(false);
                  onUpdatePersona({
                    compiledPrompt: promptBackup.compiledPrompt,
                    builderManaged: false,
                    generatedPromptMode: 'vnext'
                  });
                }}
              >
                {restoreArmed ? '确认还原' : '还原原版'}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
