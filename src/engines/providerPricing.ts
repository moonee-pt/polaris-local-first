import type { ChatTokenUsage, ProviderPricing } from '../types/domain';

export const DEFAULT_PROVIDER_PRICING: ProviderPricing = {
  mode: 'usage',
  inputPerMillion: null,
  outputPerMillion: null,
  cachePerMillion: null,
  perCall: null
};

function toOptionalPrice(value: unknown): number | null {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

export function normalizeProviderPricing(value: unknown): ProviderPricing {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<ProviderPricing>
    : {};

  return {
    mode: source.mode === 'call' ? 'call' : 'usage',
    inputPerMillion: toOptionalPrice(source.inputPerMillion),
    outputPerMillion: toOptionalPrice(source.outputPerMillion),
    cachePerMillion: toOptionalPrice(source.cachePerMillion),
    perCall: toOptionalPrice(source.perCall)
  };
}

export function isProviderPricingConfigured(pricing: ProviderPricing | undefined | null): boolean {
  if (!pricing) return false;
  if (pricing.mode === 'call') return (pricing.perCall ?? 0) > 0;
  return (pricing.inputPerMillion ?? 0) > 0 || (pricing.outputPerMillion ?? 0) > 0;
}

export type ReplyCostLineKind = 'input' | 'cache' | 'output';

export type ReplyCostLine = {
  kind: ReplyCostLineKind;
  tokens: number;
  pricePerMillion: number;
  amount: number;
};

export type ReplyCostBreakdown = {
  lines: ReplyCostLine[];
  total: number;
};

export function buildReplyCostBreakdown(
  usage: ChatTokenUsage | undefined,
  legacyTotalTokens: number | undefined,
  pricing: ProviderPricing | undefined | null
): ReplyCostBreakdown | null {
  if (!pricing || pricing.mode !== 'usage' || !isProviderPricingConfigured(pricing)) return null;

  const inputPrice = pricing.inputPerMillion ?? 0;
  const outputPrice = pricing.outputPerMillion ?? 0;
  const cachePrice = pricing.cachePerMillion ?? inputPrice;

  const cachedInput = usage?.cachedInputTokens ?? 0;
  const inputTotal = usage?.inputTokens ?? legacyTotalTokens;
  const outputTotal = usage?.outputTokens ?? 0;
  if (inputTotal === undefined && outputTotal === 0) return null;

  const uncachedInput = usage?.cacheMissInputTokens
    ?? (inputTotal === undefined ? 0 : Math.max(inputTotal - cachedInput, 0));

  const lines: ReplyCostLine[] = [
    { kind: 'input', tokens: uncachedInput, pricePerMillion: inputPrice, amount: uncachedInput * inputPrice / 1_000_000 }
  ];
  if (cachedInput > 0) {
    lines.push({ kind: 'cache', tokens: cachedInput, pricePerMillion: cachePrice, amount: cachedInput * cachePrice / 1_000_000 });
  }
  lines.push({ kind: 'output', tokens: outputTotal, pricePerMillion: outputPrice, amount: outputTotal * outputPrice / 1_000_000 });

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return { lines, total };
}

export function computeReplyCost(
  usage: ChatTokenUsage | undefined,
  legacyTotalTokens: number | undefined,
  pricing: ProviderPricing | undefined | null
): number | null {
  if (!isProviderPricingConfigured(pricing) || !pricing) return null;
  if (pricing.mode === 'call') return pricing.perCall;
  const breakdown = buildReplyCostBreakdown(usage, legacyTotalTokens, pricing);
  return breakdown && Number.isFinite(breakdown.total) ? breakdown.total : null;
}

export function formatReplyCost(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '';
  const digits = value >= 1 ? 2 : value >= 0.01 ? 3 : 4;
  const fixed = value.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  return '￥' + fixed;
}
