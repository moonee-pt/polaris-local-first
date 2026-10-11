import { describe, expect, it } from 'vitest';
import { shouldShowWorldSwitchVeil } from './worldSwitchVeilVisibility';

describe('shouldShowWorldSwitchVeil', () => {
  it('keeps the world switch handle in the collection world', () => {
    expect(shouldShowWorldSwitchVeil('collection')).toBe(true);
  });

  it('removes the world switch handle from chat (logo is the only toggle) and group', () => {
    expect(shouldShowWorldSwitchVeil('chat')).toBe(false);
    expect(shouldShowWorldSwitchVeil('group')).toBe(false);
  });
});
