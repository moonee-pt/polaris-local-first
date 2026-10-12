const MAX_PROGRESS_TITLE_LENGTH = 24;
const MAX_STATE_LINE_LENGTH = 12;

export const PROGRESS_TITLE_MIN_ROUNDS_BETWEEN_CHANGES = 1;

/**
 * The model decides whether the title still fits and repeats it when nothing moved.
 * A new title it writes lands on the next round, so when the user asks for a
 * different name it is not silently dropped.
 */
export function shouldApplyProgressTitleChange(args: {
  userRoundCount: number;
  lastAppliedRound?: number | null;
}) {
  if (args.lastAppliedRound == null) return true;
  return args.userRoundCount - args.lastAppliedRound >= PROGRESS_TITLE_MIN_ROUNDS_BETWEEN_CHANGES;
}

function createProgressTagPattern() {
  return /<polaris-progress>\s*([\s\S]*?)\s*<\/polaris-progress>/gi;
}

function createProgressTagTailPattern() {
  return /<polaris-progress>[\s\S]*$/i;
}

function normalizeProgressTitle(value: string | undefined): string {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
  return normalized.slice(0, MAX_PROGRESS_TITLE_LENGTH);
}

function createStateTagPattern() {
  return /<polaris-state>\s*([\s\S]*?)\s*<\/polaris-state>/gi;
}

function createStateTagTailPattern() {
  return /<polaris-state>[\s\S]*$/i;
}

function normalizeStateLine(value: string | undefined): string {
  const normalized = value
    ?.replace(/[，,、；;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() ?? '';
  return normalized.slice(0, MAX_STATE_LINE_LENGTH);
}

export function stripProgressTagsFromReply(content: string) {
  return content
    .replace(createProgressTagPattern(), '')
    .replace(createStateTagPattern(), '')
    .replace(createProgressTagTailPattern(), '')
    .replace(createStateTagTailPattern(), '')
    .replace(/\s+$/, '');
}

export function parseAssistantProgressTitle(content: string) {
  const titleMatches = [...content.matchAll(createProgressTagPattern())];
  const stateMatches = [...content.matchAll(createStateTagPattern())];
  const rawTitle = titleMatches.length > 0 ? titleMatches[titleMatches.length - 1]?.[1] : undefined;
  const rawState = stateMatches.length > 0 ? stateMatches[stateMatches.length - 1]?.[1] : undefined;

  return {
    displayContent: stripProgressTagsFromReply(content),
    progressTitle: normalizeProgressTitle(rawTitle) || null,
    liveState: normalizeStateLine(rawState) || null
  };
}
