import { describe, expect, it, vi } from 'vitest';
import { createChatMemoryActions } from './chatMemoryToolActions';
import type { ChatMessage, Persona, ToolInvocation } from '../../types/domain';
import type { WritableConversationBody } from '../../stores/chatStore';

const COLLABORATOR_ID = 'persona-moon';
const ORIGINAL_PROMPT = '她亲手写的提示词：说话简短、不爱用感叹号。';

function writableConversation(): WritableConversationBody {
  return {
    conversationId: 'conv-1',
    conversation: {
      id: 'conv-1',
      title: '测试对话',
      collaboratorId: COLLABORATOR_ID,
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages: []
    },
    messages: []
  };
}

function createCollaborator(overrides: Partial<Persona> = {}): Persona {
  return {
    id: COLLABORATOR_ID,
    name: '小满',
    avatar: '',
    role: 'assistant',
    prompt: '',
    tone: '',
    accent: '',
    compiledPrompt: ORIGINAL_PROMPT,
    promptBackup: null,
    tags: {
      temperament: [],
      interaction: [],
      expression: [],
      thinking: [],
      action: []
    },
    color: '#000',
    createdAt: 1,
    updatedAt: 1,
    memory: {
      inheritGlobal: true,
      excludedGlobalIds: [],
      personalMemories: [],
      referenceDocs: []
    },
    deepDefinition: {
      identityHint: '',
      missionHint: '',
      conflictPriority: '',
      conflictReason: '',
      avoidBecoming: '',
      correctiveAction: '',
      vulnerableFirst: '',
      vulnerableThen: '',
      hardBoundary: '',
      hardBoundaryAction: ''
    },
    advanced: {
      modelOverride: '',
      temperature: '',
      topP: '',
      maxTokens: '',
      thinkingBudget: '',
      contextMessageLimit: '',
      showThinking: false,
      streaming: true,
      customHeaders: '',
      customBody: '',
      regexRules: '',
      snippets: []
    },
    ...overrides
  } as unknown as Persona;
}

function createPersonaPromptActions(collaborator: Persona) {
  const addRuntimeToolMessage = vi.fn();
  const setCommandStatus = vi.fn();
  const updateCollaborator = vi.fn();
  const updateMessage = vi.fn();
  const actions = createChatMemoryActions({
    ui: { setCommandStatus },
    store: {
      chat: {
        findConversation: vi.fn(() => ({ id: 'conv-1', collaboratorId: COLLABORATOR_ID })),
        updateMessage
      } as never,
      persona: {
        activeCollaboratorId: COLLABORATOR_ID,
        findCollaborator: vi.fn((id: string) => (id === COLLABORATOR_ID ? collaborator : null)),
        updateCollaborator
      } as never
    },
    frontstageCollaboratorId: null,
    activeConversation: { id: 'conv-1', collaboratorId: COLLABORATOR_ID },
    addRuntimeToolMessage
  });

  return {
    actions,
    addRuntimeToolMessage,
    setCommandStatus,
    updateCollaborator,
    updateMessage
  };
}

function personaPreviewMessage(draft = '新版本：说话更松一点，允许开玩笑。'): ChatMessage {
  return {
    id: 'persona-preview-message',
    role: 'system',
    content: '确认改写人设',
    timestamp: 1,
    toolInvocation: {
      id: 'tool-persona-preview',
      kind: 'updatePersonaPrompt',
      status: 'preview',
      title: '确认改写人设',
      summary: '小满 · 想换成更口语的一版',
      personaPromptDraft: draft
    }
  };
}

describe('对话内改写人设', () => {
  it('只出确认卡片，不直接写角色', () => {
    const { actions, addRuntimeToolMessage, updateCollaborator } = createPersonaPromptActions(createCollaborator());

    const handled = actions.maybeHandleWriteMemoryAction(writableConversation(), {
      kind: 'updatePersonaPrompt',
      prompt: '新版本：说话更松一点，允许开玩笑。',
      reason: '想换成更口语的一版'
    });

    expect(handled).toBe(true);
    expect(updateCollaborator).not.toHaveBeenCalled();
    const invocation = addRuntimeToolMessage.mock.calls[0]?.[1] as ToolInvocation | undefined;
    expect(invocation?.status).toBe('preview');
    expect(invocation?.personaPromptDraft).toBe('新版本：说话更松一点，允许开玩笑。');
    expect(invocation?.detailText).toContain('新版本：说话更松一点，允许开玩笑。');
    expect(invocation?.detailText).toContain('想换成更口语的一版');
  });

  it('确认后才写入，并把她手写的那版留档', () => {
    const target = writableConversation();
    const { actions, updateCollaborator, updateMessage } = createPersonaPromptActions(createCollaborator());

    expect(actions.applyMemoryPreview(target, personaPreviewMessage())).toBe(true);

    expect(updateCollaborator).toHaveBeenCalledWith(COLLABORATOR_ID, expect.objectContaining({
      compiledPrompt: '新版本：说话更松一点，允许开玩笑。',
      builderManaged: false,
      generatedPromptMode: 'vnext',
      promptBackup: expect.objectContaining({ compiledPrompt: ORIGINAL_PROMPT })
    }));
    expect(updateMessage).toHaveBeenCalledWith(
      target,
      'persona-preview-message',
      expect.objectContaining({
        toolInvocation: expect.objectContaining({ status: 'applied' })
      })
    );
  });

  it('已经留过档就不再覆盖那份留档', () => {
    const archived = { compiledPrompt: '最早那一版', savedAt: 123 };
    const { actions, updateCollaborator } = createPersonaPromptActions(
      createCollaborator({ compiledPrompt: '上一轮 AI 改的', promptBackup: archived })
    );

    actions.applyMemoryPreview(writableConversation(), personaPreviewMessage());

    expect(updateCollaborator).toHaveBeenCalledWith(COLLABORATOR_ID, expect.objectContaining({
      promptBackup: archived
    }));
  });

  it('取消时不写入任何内容', () => {
    const { actions, updateCollaborator, updateMessage } = createPersonaPromptActions(createCollaborator());

    expect(actions.rollbackMemoryPreview(writableConversation(), personaPreviewMessage())).toBe(true);

    expect(updateCollaborator).not.toHaveBeenCalled();
    expect(updateMessage).toHaveBeenCalledWith(
      expect.anything(),
      'persona-preview-message',
      expect.objectContaining({
        toolInvocation: expect.objectContaining({ status: 'rolled_back' })
      })
    );
  });

  it('内建人格不开放改写', () => {
    const { actions, addRuntimeToolMessage, updateCollaborator } = createPersonaPromptActions(
      createCollaborator({ id: 'pharos', systemRole: 'default' })
    );

    const handled = actions.maybeHandleWriteMemoryAction(writableConversation(), {
      kind: 'updatePersonaPrompt',
      prompt: '想改一下自己。'
    });

    expect(handled).toBe(true);
    expect(updateCollaborator).not.toHaveBeenCalled();
    const invocation = addRuntimeToolMessage.mock.calls[0]?.[1] as ToolInvocation | undefined;
    expect(invocation?.status).toBe('failed');
  });

  it('空的一版不会写入', () => {
    const { actions, addRuntimeToolMessage, updateCollaborator } = createPersonaPromptActions(createCollaborator());

    actions.maybeHandleWriteMemoryAction(writableConversation(), {
      kind: 'updatePersonaPrompt',
      prompt: '   '
    });

    expect(updateCollaborator).not.toHaveBeenCalled();
    const invocation = addRuntimeToolMessage.mock.calls[0]?.[1] as ToolInvocation | undefined;
    expect(invocation?.status).toBe('failed');
  });
});
