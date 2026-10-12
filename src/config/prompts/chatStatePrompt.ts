/**
 * Always-on instruction: every reply also ends with one short line about what the
 * assistant is doing right now. The client parses the tag out before the reply is
 * rendered or spoken, so the user never hears it — it becomes the small line under
 * the collaborator name at the top of the chat.
 */
export function buildChatStateInstruction(currentState?: string | null) {
  const current = currentState?.trim();
  return [
    '[当前状态]',
    '再单独起一行，用 <polaris-state>…</polaris-state> 包住你此刻的状态，例如 <polaris-state>在调封面色调</polaris-state>。',
    '- 尖括号里不超过 12 个字，不写逗号，只写状态本身，不要带自己的名字。',
    '- 写你现在在干什么、想干什么、待办或心里怎么想都行，可以混着来。',
    current
      ? `- 现在的状态是「${current}」。没变就一字不差地重复它；变了就换新的。`
      : '- 这是第一次写状态。',
    '- 这行会显示在对话顶部，不会被念出来。'
  ].join('\n');
}
