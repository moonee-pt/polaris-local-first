import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROVIDER_PRICING,
  buildReplyCostBreakdown,
  computeReplyCost,
  formatReplyCost,
  isProviderPricingConfigured,
  normalizeProviderPricing
} from './providerPricing';

describe('normalizeProviderPricing', () => {
  it('keeps valid prices and defaults the mode', () => {
    expect(normalizeProviderPricing({ inputPerMillion: 180, outputPerMillion: '180', cachePerMillion: 18, perCall: 4 }))
      .toEqual({ mode: 'usage', inputPerMillion: 180, outputPerMillion: 180, cachePerMillion: 18, perCall: 4 });
  });

  it('drops invalid values to null', () => {
    expect(normalizeProviderPricing({ mode: 'call', perCall: -3, inputPerMillion: Number.NaN }))
      .toEqual({ ...DEFAULT_PROVIDER_PRICING, mode: 'call' });
  });
});

describe('computeReplyCost', () => {
  it('charges uncached input, cached input, and output separately', () => {
    const pricing = normalizeProviderPricing({ inputPerMillion: 180, outputPerMillion: 180, cachePerMillion: 18 });
    const cost = computeReplyCost({ inputTokens: 10_000, outputTokens: 5_000, cachedInputTokens: 4_000 }, undefined, pricing);
    expect(cost).toBeCloseTo(2.052, 6);
  });

  it('falls back to the input price when a cache price is unset', () => {
    const pricing = normalizeProviderPricing({ inputPerMillion: 100 });
    expect(computeReplyCost({ inputTokens: 2_000, cachedInputTokens: 2_000 }, undefined, pricing)).toBeCloseTo(0.2, 6);
  });

  it('bills a flat price per call', () => {
    const pricing = normalizeProviderPricing({ mode: 'call', perCall: 4 });
    expect(computeReplyCost(undefined, undefined, pricing)).toBe(4);
  });

  it('returns null when nothing is configured', () => {
    expect(computeReplyCost({ inputTokens: 10 }, undefined, DEFAULT_PROVIDER_PRICING)).toBeNull();
    expect(computeReplyCost({ inputTokens: 10 }, undefined, null)).toBeNull();
  });
});

describe('buildReplyCostBreakdown', () => {
  it('lists input, cache, and output lines and sums the total', () => {
    const pricing = normalizeProviderPricing({ inputPerMillion: 180, outputPerMillion: 180, cachePerMillion: 18 });
    const breakdown = buildReplyCostBreakdown({ inputTokens: 10_000, outputTokens: 5_000, cachedInputTokens: 4_000 }, undefined, pricing);
    expect(breakdown).not.toBeNull();
    expect(breakdown!.lines.map((line) => line.kind)).toEqual(['input', 'cache', 'output']);
    expect(breakdown!.lines[0]).toMatchObject({ tokens: 6_000, pricePerMillion: 180 });
    expect(breakdown!.lines[1]).toMatchObject({ tokens: 4_000, pricePerMillion: 18 });
    expect(breakdown!.total).toBeCloseTo(2.052, 6);
  });

  it('omits the cache line when nothing was cached', () => {
    const pricing = normalizeProviderPricing({ inputPerMillion: 100, outputPerMillion: 100 });
    const breakdown = buildReplyCostBreakdown({ inputTokens: 1_000, outputTokens: 1_000 }, undefined, pricing);
    expect(breakdown!.lines.map((line) => line.kind)).toEqual(['input', 'output']);
  });

  it('has no breakdown for flat per-call pricing', () => {
    const pricing = normalizeProviderPricing({ mode: 'call', perCall: 4 });
    expect(buildReplyCostBreakdown({ inputTokens: 10 }, undefined, pricing)).toBeNull();
  });
});

describe('isProviderPricingConfigured', () => {
  it('needs a positive price for the active mode', () => {
    expect(isProviderPricingConfigured(normalizeProviderPricing({ mode: 'call', perCall: 4 }))).toBe(true);
    expect(isProviderPricingConfigured(normalizeProviderPricing({ mode: 'call' }))).toBe(false);
    expect(isProviderPricingConfigured(normalizeProviderPricing({ inputPerMillion: 180 }))).toBe(true);
    expect(isProviderPricingConfigured(DEFAULT_PROVIDER_PRICING)).toBe(false);
  });
});

describe('formatReplyCost', () => {
  it('trims trailing zeros and adapts precision to the size', () => {
    expect(formatReplyCost(7)).toBe('￥7');
    expect(formatReplyCost(7.5)).toBe('￥7.5');
    expect(formatReplyCost(7.53)).toBe('￥7.53');
    expect(formatReplyCost(0.1)).toBe('￥0.1');
    expect(formatReplyCost(0.035)).toBe('￥0.035');
  });
});
