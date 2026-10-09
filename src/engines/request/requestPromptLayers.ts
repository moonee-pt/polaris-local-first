import type { AssistantToolContext } from '../assistantToolProtocol';
import type { ProviderCapabilityPromptInjection } from '../provider-runtime';
import type { AssistantPromptPart, PersonaRuntimePromptSource } from './requestAudit';
import type { TemplateContext } from '../templateEngine';
import type { ChatMessage, ConversationTaskState } from '../../types/domain';
import { buildRegexTriggerContext } from '../regexTriggerProcessor';
import { buildCapabilityEntries } from './requestPromptCapabilities';
import { buildIdentityEntries } from './requestPromptIdentity';
import { buildModelRuntimeEntry, buildRuntimeClockEntry, buildWorkRuntimeEntry } from './requestPromptRuntime';
import { buildSystemIdentityEntries } from './requestPromptSystemIdentity';
import type { AssistantToolPromptProtocolMode } from '../tool-protocol/assistantToolProtocolPrompt';

export function buildAssistantPromptLayers(params: {
  personaPrompt: string;
  personaPromptSource: PersonaRuntimePromptSource;
  templateContext: TemplateContext;
  messages: ChatMessage[];
  regexTriggers?: string;
  languageStylePrompt?: string;
  currentTask?: ConversationTaskState | null;
  includeRuntimeClockContext?: boolean;
  promptInjections?: ProviderCapabilityPromptInjection[];
  toolContext?: AssistantToolContext;
  toolProtocolMode?: AssistantToolPromptProtocolMode;
  modeInstruction?: string;
}): string[] {
  return buildAssistantPromptParts(params)
    .filter((part) => part.enabled)
    .map((part) => part.content);
}

export function buildAssistantPromptParts(params: {
  personaPrompt: string;
  personaPromptSource: PersonaRuntimePromptSource;
  templateContext: TemplateContext;
  messages: ChatMessage[];
  regexTriggers?: string;
  languageStylePrompt?: string;
  currentTask?: ConversationTaskState | null;
  includeRuntimeClockContext?: boolean;
  promptInjections?: ProviderCapabilityPromptInjection[];
  toolContext?: AssistantToolContext;
  toolProtocolMode?: AssistantToolPromptProtocolMode;
  modeInstruction?: string;
}): AssistantPromptPart[] {
  const { personaPrompt, personaPromptSource, templateContext, messages, regexTriggers, languageStylePrompt, currentTask, includeRuntimeClockContext, promptInjections, toolContext, toolProtocolMode, modeInstruction } = params;
  const systemIdentityEntries = buildSystemIdentityEntries();
  const identityEntries = buildIdentityEntries({
    personaPrompt,
    personaPromptSource,
    templateContext
  });
  const modelRuntimeEntry = buildModelRuntimeEntry({ promptInjections, toolContext });
  const runtimeClockEntry = includeRuntimeClockContext ? buildRuntimeClockEntry(templateContext) : null;
  const regexTriggerEntry = {
    name: 'regex_trigger_context' as const,
    label: '正则触发',
    role: 'system' as const,
    layer: 'context' as const,
    truncationPriority: 52,
    content: buildRegexTriggerContext(messages, regexTriggers),
    enabled: false,
    charCount: 0
  };
  const languageStyleEntry = {
    name: 'language_style_prompt' as const,
    label: '语言风格',
    role: 'system' as const,
    layer: 'context' as const,
    truncationPriority: 56,
    content: languageStylePrompt?.trim() ?? '',
    enabled: false,
    charCount: 0
  };
  const workRuntimeEntry = buildWorkRuntimeEntry({ currentTask, messages, toolContext });
  const capabilityEntries = buildCapabilityEntries({ messages, toolContext, toolProtocolMode });
  const modeInstructionEntry = {
    name: 'speech_cue_instruction' as const,
    label: '语音演出标记',
    role: 'system' as const,
    layer: 'context' as const,
    truncationPriority: 58,
    content: modeInstruction?.trim() ?? '',
    enabled: false,
    charCount: 0
  };

  return [
    ...systemIdentityEntries,
    ...identityEntries,
    ...capabilityEntries,
    modeInstructionEntry,
    languageStyleEntry,
    ...(runtimeClockEntry ? [runtimeClockEntry] : []),
    ...(modelRuntimeEntry ? [modelRuntimeEntry] : []),
    regexTriggerEntry,
    ...(workRuntimeEntry ? [workRuntimeEntry] : [])
  ].map((part) => ({
    ...part,
    enabled: Boolean(part.content),
    charCount: part.content.length
  }));
}
