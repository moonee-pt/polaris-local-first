import { useState } from 'react';
import type { ChatMessage } from '../../../../types/domain';
import { Icon } from '../../../Icon';
import { formatTokenCount } from '../chatTokenCount';
import { buildReplyCostBreakdown, computeReplyCost, formatReplyCost } from '../../../../engines/providerPricing';
import { useRuntimeStore } from '../../../../stores/runtimeStore';
import { useI18n } from '../../../../i18n';

type MessageMetaProps = {
  message: ChatMessage;
  fallbackAssistantName: string;
  isThinkingActive: boolean;
  onOpenThinkingSummary: (message: ChatMessage) => void;
  canOpenThinkingSummary?: boolean;
  showIdentity?: boolean;
  showName?: boolean;
  showDetails?: boolean;
  showThinking?: boolean;
  splitIdentityLines?: boolean;
};

const COST_LINE_LABEL_KEY = {
  input: 'chat.messageMeta.costLineInput',
  cache: 'chat.messageMeta.costLineCache',
  output: 'chat.messageMeta.costLineOutput'
} as const;

export function MessageMeta({
  message,
  fallbackAssistantName,
  isThinkingActive,
  onOpenThinkingSummary,
  canOpenThinkingSummary = false,
  showIdentity = true,
  showName = true,
  showDetails = true,
  showThinking = true,
  splitIdentityLines = false
}: MessageMetaProps) {
  const { formatNumber, t } = useI18n();
  const [usageOpen, setUsageOpen] = useState(false);
  const pricing = useRuntimeStore((state) => (
    message.providerId
      ? state.providers.find((provider) => provider.id === message.providerId)?.pricing ?? null
      : null
  ));
  const tokenLabel = formatTokenCount(message.tokenCount, message.tokenUsage, {
    formatNumber,
    totalLabel: (count) => t('chat.messageMeta.totalTokens', { count })
  });
  const replyCost = computeReplyCost(message.tokenUsage, message.tokenCount, pricing);
  const costLabel = replyCost === null ? '' : formatReplyCost(replyCost);
  const breakdown = pricing && pricing.mode === 'usage'
    ? buildReplyCostBreakdown(message.tokenUsage, message.tokenCount, pricing)
    : null;
  const identityName = message.assistantName || fallbackAssistantName;
  const showIdentityDetail = showDetails && Boolean(message.model || tokenLabel || costLabel);
  const identityDetail = (
    <>
      {message.model && <span className="message-identity-pill">{message.model}</span>}
      {tokenLabel && <span className="message-identity-pill">{tokenLabel}</span>}
      {costLabel ? (breakdown ? (
        <button
          type="button"
          className={`message-identity-pill message-cost-pill ${usageOpen ? 'open' : ''}`}
          aria-expanded={usageOpen}
          aria-label={t('chat.messageMeta.costToggleAria', { cost: costLabel })}
          onClick={() => setUsageOpen((previous) => !previous)}
        >
          {costLabel}
        </button>
      ) : (
        <span className="message-identity-pill" aria-label={t('chat.messageMeta.costAria', { cost: costLabel })}>
          {costLabel}
        </span>
      )) : null}
    </>
  );

  return (
    <>
      <div className={`message-identity-row ${showIdentity ? '' : 'thinking-only'}`.trim()}>
        {showIdentity ? (
          <div className={splitIdentityLines ? 'message-identity-stack' : 'message-identity-meta'}>
            {splitIdentityLines && showName ? (
              <>
                <span className="message-identity-name message-identity-name-primary">{identityName}</span>
                {showIdentityDetail ? (
                  <div className="message-identity-meta message-identity-secondary">
                    {identityDetail}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {showName ? <span className="message-identity-name">{identityName}</span> : null}
                {showIdentityDetail ? identityDetail : null}
              </>
            )}
          </div>
        ) : null}
        {showThinking && canOpenThinkingSummary ? (
          <button
            type="button"
            className={`thinking-inline-trigger ${isThinkingActive ? 'active' : ''}`}
            aria-label={isThinkingActive ? t('chat.messageActions.openThinkingActive') : t('chat.messageActions.openThinking')}
            title={isThinkingActive ? t('chat.messageActions.thinkingTitleActive') : t('chat.messageActions.thinkingTitle')}
            onClick={() => onOpenThinkingSummary(message)}
          >
            <span className={`thinking-inline-icon ${isThinkingActive ? 'spinning' : ''}`} aria-hidden="true">
              <Icon name="polarisStar" size={14} color="polarisDeepSpace" />
            </span>
          </button>
        ) : null}
      </div>
      {usageOpen && breakdown ? (
        <div className="message-cost-breakdown" role="group" aria-label={t('chat.messageMeta.costBreakdownTitle')}>
          {breakdown.lines.map((line) => (
            <div className="message-cost-breakdown-row" key={line.kind}>
              <span className="message-cost-breakdown-label">{t(COST_LINE_LABEL_KEY[line.kind])}</span>
              <span className="message-cost-breakdown-calc">
                {t('chat.messageMeta.costLineCalc', {
                  tokens: formatNumber(line.tokens),
                  price: formatNumber(line.pricePerMillion)
                })}
              </span>
              <span className="message-cost-breakdown-amount">{formatReplyCost(line.amount)}</span>
            </div>
          ))}
          <div className="message-cost-breakdown-row total">
            <span className="message-cost-breakdown-label">{t('chat.messageMeta.costTotal')}</span>
            <span className="message-cost-breakdown-amount">{costLabel}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
