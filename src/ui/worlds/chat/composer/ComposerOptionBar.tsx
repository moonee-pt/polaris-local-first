import { useCallback, useMemo } from 'react';
import { useChatActions, useChatStablePayload, useChatUi } from '../context/ChatContext';
import { MessageOptionBar } from '../message/MessageOptionBar';
import { extractOptionBarBlock } from '../message/messageRichMarkup';

/**
 * The choices the assistant just offered, docked above the composer instead of sitting in the
 * transcript. It only ever reads the newest reply, so picking one clears the bar and the answer
 * lands as an ordinary user message.
 */
export function ComposerOptionBar() {
  const { conversation, messages } = useChatStablePayload();
  const ui = useChatUi();
  const actions = useChatActions();

  const options = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!message || message.toolInvocation) continue;
      if (message.role !== 'assistant') return null;
      return extractOptionBarBlock(message.content ?? '')?.options ?? null;
    }
    return null;
  }, [messages]);

  const handleSelect = useCallback((text: string) => {
    if (!conversation) return;
    actions.setConversationDraft(conversation.id, text);
    void actions.submit();
  }, [actions, conversation]);

  if (!conversation || ui.sending || !options || options.length === 0) return null;

  return (
    <div className="composer-option-bar">
      <MessageOptionBar options={options} interactive onSelect={handleSelect} />
    </div>
  );
}
