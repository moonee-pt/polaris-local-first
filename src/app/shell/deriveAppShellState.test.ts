import { describe, expect, it } from 'vitest';
import { deriveAppShellState } from './deriveAppShellState';
import type { Persona } from '../../types/domain';

const persona = {
  id: 'aa',
  name: '用户'
} as Persona;

const baseArgs = {
  activeThemePreview: null,
  personas: [persona],
  frontstageCollaboratorId: 'aa',
  activeConversationLiveState: null,
  activeConversationCollaboratorId: 'aa',
  activeConversationMessageCount: 0,
  collectionRenderItemCount: 0,
    labels: {
      collectionWorld: 'Rooms',
      chatWorld: 'Chat',
      unnamedConversation: 'Untitled conversation'
    }
};

describe('deriveAppShellState', () => {
  it('uses the frontstage collaborator as the chat topbar root', () => {
    const state = deriveAppShellState({
      ...baseArgs,
      activeWorld: 'chat',
      personas: [
        persona,
        {
          id: 'bb',
          name: 'BB'
        } as Persona
      ],
      frontstageCollaboratorId: 'aa',
      activeConversationCollaboratorId: 'bb'
    });

    expect(state.topbarTitle).toBe('用户');
    expect(state.topbarTitleTone).toBe('collaborator');
  });

  it('uses chat message count for chat render density', () => {
    const state = deriveAppShellState({
      ...baseArgs,
      activeWorld: 'chat',
      activeConversationMessageCount: 43,
      collectionRenderItemCount: 0
    });

    expect(state.activeChatDensity).toBe('heavy');
  });

  it('uses collection item count for collection render density', () => {
    const state = deriveAppShellState({
      ...baseArgs,
      activeWorld: 'collection',
      activeConversationMessageCount: 3,
      collectionRenderItemCount: 27
    });

    expect(state.activeChatDensity).toBe('dense');
  });

  it('keeps group world as its own shell state', () => {
    const state = deriveAppShellState({
      ...baseArgs,
      activeWorld: 'group',
      frontstageCollaboratorId: 'aa'
    });

    expect(state.topbarTitle).toBe('Polaris');
    expect(state.worldLabel).toBe('群聊');
    expect(state.showTopbarShell).toBe(false);
    expect(state.showTopbarTitle).toBe(true);
  });

  it('shows the collaborator with no detail in a fresh chat before any state', () => {
    const state = deriveAppShellState({
      ...baseArgs,
      activeWorld: 'chat',
      activeConversationLiveState: null,
      activeConversationCollaboratorId: null
    });

    expect(state.topbarTitle).toBe(persona.name);
    expect(state.topbarTitleTone).toBe('collaborator');
    expect(state.worldLabel).toBe('Chat');
    expect(state.worldDetail).toBeNull();
  });

  it('shows only the live state under the collaborator name in chat', () => {
    const state = deriveAppShellState({
      ...baseArgs,
      activeWorld: 'chat',
      activeConversationLiveState: '在调封面色调'
    });

    expect(state.worldLabel).toBe('');
    expect(state.worldDetail).toBe('在调封面色调');
  });

  it('trims the live state and drops it outside chat', () => {
    const state = deriveAppShellState({
      ...baseArgs,
      activeWorld: 'collection',
      activeConversationLiveState: '  在调封面色调  '
    });

    expect(state.worldLabel).toBe('Rooms');
    expect(state.worldDetail).toBeNull();
  });
});
