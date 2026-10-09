import type { ReactNode } from 'react';
import { useI18n } from '../../../../i18n';
import type { I18nKey } from '../../../../i18n/messages';

/**
 * Bracketed performance cues are read by the TTS model, so the transcript shows the
 * human-readable name instead of the raw English tag. Anything not on this list is
 * left exactly as written.
 */
const TAG_SLUGS: Record<string, string> = {
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
  dryplap: 'dryplap',
  wetplap: 'wetplap',
  wet: 'wet',
  stroke: 'stroke',
  cum: 'cum',
  pullout: 'pullout'
};

const INTENSITY_SLUGS: Record<string, string> = { soft: 'cueSoft', hard: 'cueHard' };

const TAG_PATTERN = /\[([a-z][a-z: ]{0,24})\]/gi;

const STAGE_SPLIT = /(（[^（）]*）)/;

function normalizeTag(inner: string) {
  return inner.trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveTag(inner: string): { slug: string; intensity: string | null } | null {
  const normalized = normalizeTag(inner);
  const direct = TAG_SLUGS[normalized];
  if (direct) return { slug: direct, intensity: null };
  const parts = normalized.split(':');
  if (parts.length === 2 && TAG_SLUGS[parts[0]] && INTENSITY_SLUGS[parts[1]]) {
    return { slug: TAG_SLUGS[parts[0]], intensity: INTENSITY_SLUGS[parts[1]] };
  }
  return null;
}

export function PerformanceTagChip({ slug, intensity = null }: { slug: string; intensity?: string | null }) {
  const { t } = useI18n();
  const key = ('chat.performanceTag.' + slug) as I18nKey;
  const label = t(key);
  if (!label || label === key) return null;
  const intensityLabel = intensity ? t(('chat.performanceTag.' + intensity) as I18nKey) : '';
  return <span className="message-performance-tag">{intensityLabel ? label + '·' + intensityLabel : label}</span>;
}

export function renderTextWithPerformanceTags(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  const pushPlain = (value: string) => {
    if (!value) return;
    for (const part of value.split(STAGE_SPLIT)) {
      if (!part) continue;
      if (part.startsWith('（') && part.endsWith('）')) {
        const inner = part.slice(1, -1);
        const block = inner.length >= 6 ? ' is-block' : '';
        nodes.push(<span key={keyPrefix + '-stage-' + index} className={'message-stage-direction' + block}>{part}</span>);
      } else {
        nodes.push(<span key={keyPrefix + '-text-' + index}>{part}</span>);
      }
      index += 1;
    }
  };
  for (const match of text.matchAll(TAG_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const resolved = resolveTag(match[1]);
    if (!resolved) continue;
    pushPlain(text.slice(cursor, matchIndex));
    nodes.push(<PerformanceTagChip key={keyPrefix + '-tag-' + index} slug={resolved.slug} intensity={resolved.intensity} />);
    index += 1;
    cursor = matchIndex + match[0].length;
  }
  pushPlain(text.slice(cursor));
  return nodes;
}