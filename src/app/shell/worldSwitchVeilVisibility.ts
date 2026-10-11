import type { World } from '../../types/domain';

export function shouldShowWorldSwitchVeil(activeWorld: World) {
  // Chat keeps only the topbar logo as the world toggle; the inline veil would duplicate it.
  return activeWorld !== 'group' && activeWorld !== 'chat';
}
