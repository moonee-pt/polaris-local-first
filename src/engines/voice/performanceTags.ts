/**
 * Bracketed delivery cues the voice engine understands. The transcript shows them as
 * labelled chips; anything that is only read aloud (tone, sfx, pauses) is dropped from
 * text meant for the eye. Body-sound cues live in fleshAmbience instead.
 */
export const PERFORMANCE_TAG_SLUGS: Record<string, string> = {
  angry: 'angry',
  sad: 'sad',
  embarrassed: 'embarrassed',
  emphasis: 'emphasis',
  whispering: 'whispering',
  soft: 'soft',
  breathy: 'breathy',
  excited: 'excited',
  laughing: 'laughing',
  chuckling: 'chuckling',
  moaning: 'moaning',
  'clear throat': 'clear_throat',
  sobbing: 'sobbing',
  'crying loudly': 'crying_loudly',
  sighing: 'sighing',
  panting: 'panting',
  groaning: 'groaning',
  'crowd laughing': 'crowd_laughing',
  'background laughter': 'background_laughter',
  'audience laughing': 'audience_laughing',
  pause: 'pause',
  'long pause': 'long_pause',
  break: 'pause',
  'long-break': 'long_pause'
};

export const PERFORMANCE_INTENSITY_SLUGS: Record<string, string> = { soft: 'cueSoft', hard: 'cueHard' };

/**
 * Laughter performed by an unseen crowd. These are stripped before synthesis because
 * the voice engine renders them as a background-audio bed that reads as an unexplained
 * ambient sound; the individual laugh/emote tags above stay.
 */
export const CROWD_LAUGHTER_TAG_SLUGS: Record<string, string> = {
  'crowd laughing': 'crowd_laughing',
  'background laughter': 'background_laughter',
  'audience laughing': 'audience_laughing'
};

export const PERFORMANCE_TAG_PATTERN = /\[([a-z][a-z: -]{0,24})\]/gi;

const TAG_BRACKET = '\\[([a-z][a-z: -]{0,24})\\]';
const TAG_WITH_TRAIL = `${TAG_BRACKET}[ \\t]?`;

export function normalizePerformanceTag(inner: string) {
  return inner.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolvePerformanceTag(inner: string): { slug: string; intensity: string | null } | null {
  const normalized = normalizePerformanceTag(inner);
  const direct = PERFORMANCE_TAG_SLUGS[normalized];
  if (direct) return { slug: direct, intensity: null };
  const parts = normalized.split(':');
  if (parts.length === 2 && PERFORMANCE_TAG_SLUGS[parts[0]] && PERFORMANCE_INTENSITY_SLUGS[parts[1]]) {
    return { slug: PERFORMANCE_TAG_SLUGS[parts[0]], intensity: PERFORMANCE_INTENSITY_SLUGS[parts[1]] };
  }
  return null;
}

export function stripPerformanceTags(text: string): string {
  if (!text) return text;
  return text
    .replace(new RegExp(TAG_WITH_TRAIL, 'gi'), (match, inner: string) => (resolvePerformanceTag(inner) ? '' : match))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Removes only the unseen-crowd laughter tags from text meant for the voice engine,
 * keeping every tone/emote/pause tag so delivery still works. Used on the TTS-bound
 * text, where a crowd tag would otherwise be synthesised as unexplained background noise.
 */
export function stripCrowdLaughterTags(text: string): string {
  if (!text) return text;
  return text
    .replace(new RegExp(TAG_WITH_TRAIL, 'gi'), (match, inner: string) => (
      CROWD_LAUGHTER_TAG_SLUGS[normalizePerformanceTag(inner).split(':')[0]] ? '' : match
    ))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

const ENGINE_TAG_BY_SLUG: Record<string, string> = {
  pause: 'break',
  long_pause: 'long-break'
};

/**
 * The voice engine spells its pauses [break] / [long-break]; the labels we show and the
 * older replies use [pause] / [long pause], which the engine would read out as the word.
 */
export function normalizePauseTagsForEngine(text: string): string {
  if (!text) return text;
  return text.replace(new RegExp(TAG_BRACKET, 'gi'), (match, inner: string) => {
    const resolved = resolvePerformanceTag(inner);
    const engineTag = resolved ? ENGINE_TAG_BY_SLUG[resolved.slug] : undefined;
    return engineTag ? `[${engineTag}]` : match;
  });
}
