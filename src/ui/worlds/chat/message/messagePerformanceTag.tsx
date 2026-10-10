import type { ReactNode } from 'react';
import { useI18n } from '../../../../i18n';
import type { I18nKey } from '../../../../i18n/messages';
import {
  PERFORMANCE_INTENSITY_SLUGS,
  PERFORMANCE_TAG_PATTERN,
  PERFORMANCE_TAG_SLUGS,
  resolvePerformanceTag
} from '../../../../engines/voice/performanceTags';

/**
 * Bracketed performance cues are read by the TTS model, so the transcript shows the
 * human-readable name instead of the raw English tag. Anything not on this list is
 * left exactly as written.
 */
const TAG_SLUGS: Record<string, string> = {
  ...PERFORMANCE_TAG_SLUGS,
  dryplap: 'dryplap',
  wetplap: 'wetplap',
  wet: 'wet',
  stroke: 'stroke',
  cum: 'cum',
  pullout: 'pullout'
};

const INTENSITY_SLUGS: Record<string, string> = PERFORMANCE_INTENSITY_SLUGS;

const TAG_PATTERN = PERFORMANCE_TAG_PATTERN;

const STAGE_SPLIT = /(（[^（）]*）)/;

function resolveTag(inner: string) {
  const resolved = resolvePerformanceTag(inner);
  if (resolved) return resolved;
  const normalized = inner.trim().toLowerCase().replace(/\s+/g, ' ');
  const parts = normalized.split(':');
  const direct = TAG_SLUGS[normalized];
  if (direct) return { slug: direct, intensity: null };
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
  let index = 0;

  const renderInline = (value: string, insideStage: boolean) => {
    let cursor = 0;
    const flush = (segment: string) => {
      if (!segment) return;
      nodes.push(<span key={`${keyPrefix}-text-${index}`}>{segment}</span>);
      index += 1;
    };
    for (const match of value.matchAll(TAG_PATTERN)) {
      const matchIndex = match.index ?? 0;
      const resolved = resolveTag(match[1]);
      if (!resolved) continue;
      flush(value.slice(cursor, matchIndex));
      nodes.push(<PerformanceTagChip key={`${keyPrefix}-tag-${index}`} slug={resolved.slug} intensity={resolved.intensity} />);
      index += 1;
      cursor = matchIndex + match[0].length;
    }
    flush(value.slice(cursor));
    void insideStage;
  };

  for (const part of text.split(STAGE_SPLIT)) {
    if (!part) continue;
    if (part.startsWith('（') && part.endsWith('）')) {
      const inner = part.slice(1, -1);
      const block = inner.length >= 6 ? ' is-block' : '';
      nodes.push(
        <span key={`${keyPrefix}-stage-${index}`} className={`message-stage-direction${block}`}>
          {`（`}
          {renderInline(inner, true)}
          {`）`}
        </span>
      );
      index += 1;
      continue;
    }
    renderInline(part, false);
  }
  return nodes;
}