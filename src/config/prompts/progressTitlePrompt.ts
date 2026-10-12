/**
 * Always-on instruction: every reply ends with a machine-readable title for the
 * conversation. The client parses the tag out before the reply is rendered or
 * spoken, so the user never hears it — it becomes the conversation's name in the
 * list. Every turn the model is shown the title it used last, so it keeps it while
 * it still fits and only writes a new one when the thread moved on or the user
 * asked for a different name.
 */
export function buildProgressTitleInstruction(currentProgressTitle?: string | null) {
  const current = currentProgressTitle?.trim();
  return [
    '[对话标题]',
    '在回复的最后单独起一行，用 <polaris-progress>…</polaris-progress> 包住这一轮给这段对话起的标题，例如 <polaris-progress>吵完之后的沉默</polaris-progress>。',
    '- 尖括号里不超过 12 个字，像一句眉目，写你们现在聊到哪儿了，例如「第三版封面定稿」「计划改到下半场」。',
    current
      ? `- 现在的进度标题是「${current}」。还合适就一字不差地重复它，别换说法；只有事情真的往前走了，或者用户让你改标题，才给新的。`
      : '- 这是第一次起标题，按你们现在聊到哪儿写一个。',
    '- 这行就是这段对话在列表里的名字，用户看得到（不会被念出来）。用户让你改标题时，直接按用户的意思写在这里。'
  ].join('\n');
}
