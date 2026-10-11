/**
 * Always-on instruction: every reply ends with a machine-readable progress title.
 * The client parses the tag out before the reply is rendered or spoken, so the user
 * never sees it — it becomes the right-hand title on the conversation list row.
 */
export function buildProgressTitleInstruction(currentProgressTitle?: string | null) {
  const current = currentProgressTitle?.trim();
  return [
    '[进度标题]',
    '在回复的最后单独起一行，用 <polaris-progress>…</polaris-progress> 包住这一轮的进度标题，例如 <polaris-progress>吵完之后的沉默</polaris-progress>。',
    '- 尖括号里不超过 12 个字，像一句眉目，写你们现在聊到哪儿了，例如「第三版封面定稿」「计划改到下半场」。',
    current
      ? `- 现在的进度标题是「${current}」。还合适就一字不差地重复它，别换说法；只有事情真的往前走了才给新的。`
      : '- 这是第一次起标题，按你们现在聊到哪儿写一个。',
    '- 这行不会被显示出来，也不会被念出来，照常写就行。'
  ].join('\n');
}
