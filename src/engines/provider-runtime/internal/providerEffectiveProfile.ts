import type { ProviderProfile } from '../../../types/domain';
import { isPolarisBuiltInProvider, POLARIS_PUBLIC_PROVIDER_MODELS } from '../../freeProvider';

export function resolveProviderEffectiveModel(
  provider: Pick<ProviderProfile, 'id' | 'model' | 'apiKey' | 'baseUrl' | 'path'>,
  modelOverride?: string | null
) {
  const trimmedOverride = modelOverride?.trim();
  if (!trimmedOverride) return provider.model;
  
  const isBuiltInModel = POLARIS_PUBLIC_PROVIDER_MODELS.includes(trimmedOverride as typeof POLARIS_PUBLIC_PROVIDER_MODELS[number]);
  if (!isPolarisBuiltInProvider(provider) && isBuiltInModel) {
    return provider.model;
  }
  
  return trimmedOverride;
}
