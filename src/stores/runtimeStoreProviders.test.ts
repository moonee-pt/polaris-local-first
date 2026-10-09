import { describe, expect, it } from 'vitest';
import type { ProviderProfile } from '../types/domain';
import {
  createCustomProviderProfile,
  filterVisibleProviders,
  mergeProviderPatch,
  normalizeProviders,
  selectVisibleActiveProvider
} from './runtimeStoreProviders';

describe('createCustomProviderProfile', () => {
  it('does not default custom providers back to the built-in /api route', () => {
    const provider = createCustomProviderProfile({
      name: '空线路'
    });

    expect(provider.baseUrl).toBe('');
    expect(provider.protocol).toBe('openai-completions');
    expect(provider.path).toBe('/chat/completions');
    expect(provider.apiKey).toBe('');
  });

  it('hydrates preset defaults for recognized upstreams', () => {
    const provider = createCustomProviderProfile({
      baseUrl: 'https://openrouter.ai/api/v1'
    });

    expect(provider.name).toBe('OpenRouter');
    expect(provider.protocol).toBe('openai-completions');
    expect(provider.path).toBe('/chat/completions');
    expect(provider.model).toBe('openrouter/auto');
    expect(provider.capabilities).toEqual({
      images: true,
      streaming: true,
      thinking: false
    });
  });
});

describe('normalizeProviders', () => {
  it('preserves custom routes without adding the public built-in provider', () => {
    const providers = normalizeProviders([
      {
        id: 'custom-1',
        name: 'Claude 镜像',
        protocol: 'openai-completions',
        baseUrl: 'https://example.com/v1',
        path: '/chat/completions',
        apiKey: '',
        model: 'anthropic/claude-sonnet-4',
        capabilities: {
          images: true,
          streaming: true,
          thinking: false
        }
      }
    ]);

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      id: 'custom-1',
      protocol: 'openai-completions',
      baseUrl: 'https://example.com/v1',
      path: '/chat/completions'
    });
  });

  it('creates a visible custom placeholder when no user provider exists yet', () => {
    const providers = normalizeProviders();

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      id: 'provider-custom-default',
      baseUrl: '',
      path: '/chat/completions',
      apiKey: '',
      model: ''
    });
  });

  it('drops persisted public providers while keeping user-owned routes', () => {
    const providers = normalizeProviders([
      {
        id: 'provider-polaris-public',
        name: 'Polaris',
        protocol: 'openai-completions',
        baseUrl: '/api',
        path: '/chat/completions',
        apiKey: 'polaris-public-free',
        model: 'Polaris',
        capabilities: {
          images: false,
          streaming: true,
          thinking: false
        }
      },
      {
        id: 'custom-1',
        name: '自带 Key',
        protocol: 'openai-completions',
        baseUrl: 'https://example.com/v1',
        path: '/chat/completions',
        apiKey: 'sk-user',
        model: 'gpt-user',
        capabilities: {
          images: false,
          streaming: true,
          thinking: false
        }
      }
    ]);

    expect(providers.map((provider) => provider.id)).toEqual(['custom-1']);
  });

});

describe('provider visibility', () => {
  it('keeps every normalized provider visible', () => {
    const providers = normalizeProviders();

    expect(filterVisibleProviders(providers)).toBe(providers);
  });

  it('returns the same visible provider array when source providers do not change', () => {
    const providers = normalizeProviders();

    expect(filterVisibleProviders(providers)).toBe(filterVisibleProviders(providers));
  });

  it('falls back to the custom placeholder when the selected id is missing', () => {
    const providers = normalizeProviders();

    const selected = selectVisibleActiveProvider(providers, 'missing-provider');

    expect(selected.id).toBe('provider-custom-default');
  });
});

describe('mergeProviderPatch', () => {
  it('hydrates recognized provider defaults when a known base URL is entered by hand', () => {
    const provider = createCustomProviderProfile({
      name: '新线路'
    });

    const merged = mergeProviderPatch(provider, {
      baseUrl: 'https://api.anthropic.com/v1'
    });

    expect(merged).toMatchObject({
      name: 'Anthropic',
      protocol: 'anthropic-messages',
      path: '/messages',
      model: 'claude-sonnet-4-6',
      capabilities: {
        images: true,
        streaming: true,
        thinking: true
      }
    });
  });

  it('keeps custom model and capabilities when switching a recognized provider base URL', () => {
    const provider = createCustomProviderProfile({
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'my-proxy-model',
      capabilities: {
        images: false,
        streaming: true,
        thinking: true
      }
    });

    const merged = mergeProviderPatch(provider, {
      baseUrl: 'https://openrouter.ai/api/v1'
    });

    expect(merged).toMatchObject({
      name: 'OpenRouter',
      protocol: 'openai-completions',
      path: '/chat/completions',
      model: 'my-proxy-model',
      capabilities: {
        images: false,
        streaming: true,
        thinking: true
      }
    });
  });

  it('converts built-in Polaris provider to custom when baseUrl is changed', () => {
    const provider: ProviderProfile = {
      id: 'provider-polaris-public',
      name: 'Polaris',
      protocol: 'openai-completions',
      baseUrl: '/api',
      path: '/chat/completions',
      apiKey: 'polaris-public-free',
      model: 'Polaris',
      capabilities: {
        images: false,
        streaming: true,
        thinking: false
      }
    };

    const merged = mergeProviderPatch(provider, {
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-test-key',
      model: 'deepseek-v4.1-flash'
    });

    expect(merged.id).not.toBe('provider-polaris-public');
    expect(merged.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
    expect(merged.apiKey).toBe('sk-test-key');
    expect(merged.model).toBe('deepseek-v4.1-flash');
  });

  it('converts built-in Polaris provider to custom when apiKey is changed', () => {
    const provider: ProviderProfile = {
      id: 'provider-polaris-public',
      name: 'Polaris',
      protocol: 'openai-completions',
      baseUrl: '/api',
      path: '/chat/completions',
      apiKey: 'polaris-public-free',
      model: 'Polaris',
      capabilities: {
        images: false,
        streaming: true,
        thinking: false
      }
    };

    const merged = mergeProviderPatch(provider, {
      apiKey: 'sk-custom-key'
    });

    expect(merged.id).not.toBe('provider-polaris-public');
    expect(merged.apiKey).toBe('sk-custom-key');
  });

  it('keeps built-in Polaris provider when only model is changed within allowlist', () => {
    const provider: ProviderProfile = {
      id: 'provider-polaris-public',
      name: 'Polaris',
      protocol: 'openai-completions',
      baseUrl: '/api',
      path: '/chat/completions',
      apiKey: 'polaris-public-free',
      model: 'Polaris',
      capabilities: {
        images: false,
        streaming: true,
        thinking: false
      }
    };

    const merged = mergeProviderPatch(provider, {
      model: 'openai/gpt-oss-120b:free'
    });

    expect(merged.id).toBe('provider-polaris-public');
    expect(merged.model).toBe('openai/gpt-oss-120b:free');
    expect(merged.baseUrl).toBe('/api');
    expect(merged.apiKey).toBe('polaris-public-free');
  });
});
