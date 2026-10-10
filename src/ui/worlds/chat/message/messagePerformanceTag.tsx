import type { ReactNode } from 'react';
import {
  PERFORMANCE_TAG_PATTERN,
  resolvePerformanceTag
} from '../../../../engines/voice/performanceTags';
import { isFleshCueTag } from '../../../../engines/voice/fleshAmbience';

/**
 * Delivery/body cues are read aloud and synthesised, so the transcript drops them
 * entirely: only the plain spoken text and the （…）stage directions remain. Anything
 * on the raw cue list (English tag or body-sound slug) is removed; unknown brackets are
 * left exactly as written. The full tag breakdown lives in the thinking sheet instead.
 */
const TAG_PATTERN = PERFORMANCE_TAG_PATTERN;

const STAGE_SPLIT = /(（[^（）]*）)/;

function isKnownCue(inner: string) {
  const normalized = inner.trim().toLowerCase().replace(/\s+/g, ' ');
  return Boolean(resolvePerformanceTag(normalized)) || isFleshCueTag(normalized);
}

export function renderTextWithPerformanceTags(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;

  const stripCues = (value: string) =>
    value.replace(TAG_PATTERN, (match, inner: string) => (isKnownCue(inner) ? '' : match));

  const renderPlain = (value: string) => {
    const cleaned = stripCues(value);
    if (!cleaned) return;
    nodes.push(<span key={`${keyPrefix}-text-${index}`}>{cleaned}</span>);
    index += 1;
  };

  for (const part of text.split(STAGE_SPLIT)) {
    if (!part) continue;
    if (part.startsWith('（') && part.endsWith('）')) {
      const inner = stripCues(part.slice(1, -1));
      const block = inner.length >= 6 ? ' is-block' : '';
      nodes.push(
        <span key={`${keyPrefix}-stage-${index}`} className={`message-stage-direction${block}`}>
          {`（${inner}）`}
        </span>
      );
      index += 1;
      continue;
    }
    renderPlain(part);
  }
  return nodes;
}
