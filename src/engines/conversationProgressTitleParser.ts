const MAX_PROGRESS_TITLE_LENGTH = 24;

export const PROGRESS_TITLE_MIN_ROUNDS_BETWEEN_CHANGES = 3;

/**
 * The model decides whether the title still fits and repeats it when nothing moved.
 * This only holds the line still for a few rounds, so a reworded synonym cannot make
 * the list row flicker.
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

export function stripProgressTagsFromReply(content: string) {
  return content
    .replace(createProgressTagPattern(), '')
    .replace(createProgressTagTailPattern(), '')
    .replace(/\s+$/, '');
}

export function parseAssistantProgressTitle(content: string) {
  const matches = [...content.matchAll(createProgressTagPattern())];
  const rawTitle = matches.length > 0 ? matches[matches.length - 1]?.[1] : undefined;

  return {
    displayContent: stripProgressTagsFromReply(content),
    progressTitle: normalizeProgressTitle(rawTitle) || null
  };
}
