import { canAssistantRewritePersonaPrompt } from '../../engines/personaBuiltin';
import { createUid } from '../../engines/id';
import type { ChatMessage, Persona } from '../../types/domain';
import type { ToolAction } from '../../engines/toolExecutor';
import type { WritableConversationBody } from '../../stores/chatStore';
import type { AddRuntimeToolMessage, ChatToolStoreBindings, ChatUiToolState } from './chatPorts';

type PersonaPromptToolAction = Extract<ToolAction, { kind: 'updatePersonaPrompt' }>;

type RewritableCollaboratorResult =
  | { persona: Persona; error: null }
  | { persona: null; error: string };

type CreateChatPersonaPromptActionsArgs = {
  ui: Pick<ChatUiToolState, 'setCommandStatus'>;
  store: Pick<ChatToolStoreBindings, 'chat' | 'persona'>;
  resolveTargetCollaborator: (conversationId?: string | null) => Persona | null;
  addRuntimeToolMessage: AddRuntimeToolMessage;
};

const LOCKED_PERSONA_ERROR = '只有你自己建的角色可以改写人设，内建人格不开放。';
const NO_TARGET_PERSONA_ERROR = '当前对话没有可改写人设的角色。';

function buildPreviewDetailText(action: PersonaPromptToolAction, draftPrompt: string) {
  const reason = action.reason?.trim() ?? '';
  return [
    '# 这一版人设提示词',
    reason ? `说明：${reason}` : '',
    draftPrompt
  ].filter(Boolean).join('\n\n');
}

/**
 * 让角色在对话里改写自己的人设提示词。
 *
 * 复用长期资料那套"确认卡片 -> 应用 / 取消"链路：工具动作只生成一张 preview 卡片，用户点确认才真正
 * 写进角色。第一次覆盖她手写的那版提示词之前，会把当时那一版存进角色的留档槽，之后角色再怎么改都不会
 * 动那份留档；内建人格（系统自带的那几个）一律不开放，工具目录里也不会出现。
 */
export function createChatPersonaPromptActions({
  ui,
  store,
  resolveTargetCollaborator,
  addRuntimeToolMessage
}: CreateChatPersonaPromptActionsArgs) {
  const resolveRewritableCollaborator = (
    conversationId?: string | null
  ): RewritableCollaboratorResult => {
    const targetCollaborator = resolveTargetCollaborator(conversationId);
    if (!targetCollaborator) return { persona: null, error: NO_TARGET_PERSONA_ERROR };
    if (!canAssistantRewritePersonaPrompt(targetCollaborator)) {
      return { persona: null, error: LOCKED_PERSONA_ERROR };
    }
    return { persona: targetCollaborator, error: null };
  };

  const writePersonaPrompt = (persona: Persona, draftPrompt: string) => {
    const nextPrompt = draftPrompt.trim();
    if (!nextPrompt) return { ok: false as const, error: '这一版人设没有可写入的正文。' };

    const currentPrompt = persona.compiledPrompt?.trim() ?? '';
    const shouldSaveBackup = !persona.promptBackup && currentPrompt.length > 0;
    const promptBackup = shouldSaveBackup
      ? { compiledPrompt: persona.compiledPrompt, savedAt: Date.now() }
      : persona.promptBackup ?? null;

    store.persona.updateCollaborator(persona.id, {
      compiledPrompt: nextPrompt,
      builderManaged: false,
      generatedPromptMode: 'vnext',
      promptBackup
    });

    return {
      ok: true as const,
      backupSaved: shouldSaveBackup,
      summary: shouldSaveBackup
        ? '已改写人设，你原来写的那版已经留档，可以在角色设置里查看或还原。'
        : '已改写人设。'
    };
  };

  const addFailedPersonaPromptMessage = (
    target: WritableConversationBody,
    action: PersonaPromptToolAction,
    message: string,
    options?: {
      beforeMessageId?: string;
      sourceToolCallId?: string;
    }
  ) => {
    addRuntimeToolMessage(target, {
      id: createUid('tool'),
      kind: 'updatePersonaPrompt',
      status: 'failed',
      title: '改写人设',
      summary: message,
      error: message,
      targetLabel: action.targetLabel,
      originMessageId: options?.beforeMessageId,
      toolCallId: options?.sourceToolCallId
    }, undefined, { beforeMessageId: options?.beforeMessageId });
    ui.setCommandStatus(message, true);
  };

  const maybeHandleUpdatePersonaPromptAction = (
    target: WritableConversationBody,
    action: ToolAction,
    options?: {
      beforeMessageId?: string;
      sourceToolCallId?: string;
    }
  ) => {
    if (action.kind !== 'updatePersonaPrompt') return false;
    const draftPrompt = action.prompt.trim();

    if (!draftPrompt) {
      addFailedPersonaPromptMessage(target, action, '这一版人设是空的，没有写入。', options);
      return true;
    }

    const { persona, error } = resolveRewritableCollaborator(target.conversationId);
    if (!persona) {
      addFailedPersonaPromptMessage(target, action, error ?? LOCKED_PERSONA_ERROR, options);
      return true;
    }

    addRuntimeToolMessage(target, {
      id: createUid('tool'),
      kind: 'updatePersonaPrompt',
      status: 'preview',
      title: '确认改写人设',
      summary: `${persona.name} · ${action.reason?.trim() || '想换成新的一版提示词'}`,
      personaPromptDraft: draftPrompt,
      personaPromptReason: action.reason,
      detailText: buildPreviewDetailText(action, draftPrompt),
      targetLabel: action.targetLabel,
      originMessageId: options?.beforeMessageId,
      toolCallId: options?.sourceToolCallId
    }, undefined, { beforeMessageId: options?.beforeMessageId });
    ui.setCommandStatus('这版人设改动等你确认后再写入。');
    return true;
  };

  const applyPersonaPromptPreview = (target: WritableConversationBody, message: ChatMessage) => {
    const invocation = message.toolInvocation;
    if (invocation?.kind !== 'updatePersonaPrompt') return false;

    const draftPrompt = invocation.personaPromptDraft?.trim() ?? '';
    const { persona, error } = resolveRewritableCollaborator(target.conversationId);
    if (!persona) {
      store.chat.updateMessage(target, message.id, {
        content: '这版人设没有写入。',
        toolInvocation: { ...invocation, status: 'failed', error }
      });
      ui.setCommandStatus(error ?? LOCKED_PERSONA_ERROR, true);
      return true;
    }

    const result = writePersonaPrompt(persona, draftPrompt);
    if (!result.ok) {
      store.chat.updateMessage(target, message.id, {
        content: '这版人设没有写入。',
        toolInvocation: { ...invocation, status: 'failed', error: result.error }
      });
      ui.setCommandStatus(result.error, true);
      return true;
    }

    store.chat.updateMessage(target, message.id, {
      content: result.summary,
      toolInvocation: { ...invocation, status: 'applied', error: undefined }
    });
    ui.setCommandStatus(result.backupSaved ? '已改写人设，原版已经留档。' : '已改写人设。');
    return true;
  };

  const rollbackPersonaPromptPreview = (target: WritableConversationBody, message: ChatMessage) => {
    const invocation = message.toolInvocation;
    if (invocation?.kind !== 'updatePersonaPrompt') return false;

    store.chat.updateMessage(target, message.id, {
      content: '这版人设没有写入。',
      toolInvocation: { ...invocation, status: 'rolled_back' }
    });
    ui.setCommandStatus('已取消这次人设改写。');
    return true;
  };

  return {
    maybeHandleUpdatePersonaPromptAction,
    applyPersonaPromptPreview,
    rollbackPersonaPromptPreview
  };
}
