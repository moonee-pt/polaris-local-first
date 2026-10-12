import type { ToolAction } from './toolExecutorTypes';
import type { ToolActionDescription } from './toolExecutorDescribe';

export type PersonaPromptToolAction = Extract<ToolAction, { kind: 'updatePersonaPrompt' }>;

/**
 * Natural-language description for the persona-prompt rewrite action. The rewrite itself is
 * confirm-gated in the chat layer (preview card -> apply/rollback), so this only renders the card
 * headline; the new prompt body travels on the invocation's `detailText`.
 */
export function describePersonaPromptToolAction(action: PersonaPromptToolAction): ToolActionDescription {
  const reason = action.reason?.trim() ?? '';
  return {
    kind: action.kind,
    title: '改写角色人设',
    summary: `${action.targetLabel || '当前角色'} · ${reason || '想换成新的一版提示词'}`,
    targetLabel: action.targetLabel
  };
}
