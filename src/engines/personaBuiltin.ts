import type { Persona } from '../types/domain';
import { POLARIS_ASSISTANT_PERSONA_ID } from '../config/persona/personaBuilder';

export function isCorePersona(persona: Persona | null | undefined): boolean {
  return persona?.systemRole === 'default';
}

export function isPharosPersona(persona: Persona | null | undefined): boolean {
  return persona?.id === 'pharos';
}

export function isProductGuidePersona(persona: Persona | null | undefined): boolean {
  return persona?.id === POLARIS_ASSISTANT_PERSONA_ID;
}

export function canEditPersonaPrompt(persona: Persona | null | undefined): boolean {
  return !isProductGuidePersona(persona) && (!isCorePersona(persona) || isPharosPersona(persona));
}

/**
 * 角色能不能在对话里改写自己的人设提示词。
 *
 * 比 `canEditPersonaPrompt` 更严：内建人格（包括 Pharos）都不开放，只有用户自己建的角色可以。
 * 改写走对话里的确认卡片，第一次覆盖用户手写的提示词前会留一份原版备份。
 */
export function canAssistantRewritePersonaPrompt(persona: Persona | null | undefined): boolean {
  return Boolean(persona) && !isCorePersona(persona) && canEditPersonaPrompt(persona);
}
