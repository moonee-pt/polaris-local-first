import { Icon } from '../../../Icon';
import { runImpactAction } from '../../../haptics';
import { useI18n, type I18nTranslator } from '../../../../i18n';
import type { ConversationTaskState } from '../../../../types/domain';
import { JumpToLatest } from './JumpToLatest';
import { JumpToTop } from './JumpToTop';

type Translate = I18nTranslator['t'];

function resolveTaskButtonLabel(t: Translate, task: ConversationTaskState | null, taskModeEnabled: boolean, collapsed: boolean) {
  if (!task) {
    return collapsed
      ? (taskModeEnabled ? t('chat.taskDock.expandArmed') : t('chat.taskDock.expandEntry'))
      : t('chat.taskDock.collapseCurrent');
  }
  if (task.status === 'completed') {
    return collapsed ? t('chat.taskDock.expandCompleted') : t('chat.taskDock.collapseCurrent');
  }
  if (task.status === 'running') {
    return collapsed ? t('chat.taskDock.expandCurrent') : t('chat.taskDock.collapseCurrent');
  }
  if (task.status === 'blocked') {
    return collapsed ? t('chat.taskDock.expandBlocked') : t('chat.taskDock.collapseCurrent');
  }
  return collapsed ? t('chat.taskDock.expandCurrent') : t('chat.taskDock.collapseCurrent');
}

export function TaskModeArmedCard({ onCollapse }: { onCollapse?: (() => void) | null }) {
  const { t } = useI18n();

  return (
    <section className="task-runtime-card task-runtime-card-armed" aria-label={t('chat.taskDock.armedAria')}>
      <div className="task-runtime-card-head">
        <div className="task-runtime-card-kicker">
          <span className="task-runtime-card-kicker-icon task-runtime-card-kicker-icon-spinning" aria-hidden="true">
            <Icon name="task" size={14} />
          </span>
          <span>{t('chat.taskDock.armedKicker')}</span>
        </div>
        <div className="task-runtime-card-head-actions">
          <span className="task-runtime-card-status running">{t('chat.taskDock.armedStatus')}</span>
          {onCollapse ? (
            <button
              type="button"
              className="task-runtime-card-collapse"
              aria-label={t('chat.taskDock.collapseArmed')}
              title={t('chat.taskDock.collapseArmed')}
              onClick={onCollapse}
            >
              <Icon name="chevronDown" size={14} />
            </button>
          ) : null}
        </div>
      </div>
      <div className="task-runtime-card-title">{t('chat.taskDock.armedTitle')}</div>
      <p className="task-runtime-card-stage">
        {t('chat.taskDock.armedBody')}
      </p>
    </section>
  );
}

export function TaskRuntimeDock({
  task,
  taskModeEnabled,
  collapsed,
  justArmed,
  justCompleted,
  showJumpToLatest,
  showJumpToTop,
  onToggleCollapsed,
  onJumpToLatest,
  onJumpToTop
}: {
  task: ConversationTaskState | null;
  taskModeEnabled: boolean;
  collapsed: boolean;
  justArmed: boolean;
  justCompleted: boolean;
  showJumpToLatest: boolean;
  showJumpToTop: boolean;
  onToggleCollapsed: () => void;
  onJumpToLatest: () => void;
  onJumpToTop: () => void;
}) {
  const { t } = useI18n();
  const buttonIcon = task?.status === 'completed' && justCompleted ? (collapsed ? 'chevronDown' : 'chevronUp') : 'task';
  const buttonStatus = task?.status === 'completed' && !justCompleted
    ? 'armed'
    : (task?.status ?? (taskModeEnabled ? 'armed' : 'idle'));
  const buttonLabel = resolveTaskButtonLabel(t, task, taskModeEnabled, collapsed);

  return (
    <div className="chat-floating-controls">
      <div className="chat-floating-controls-stack">
        {showJumpToLatest ? (
          <button
            type="button"
            className={`task-runtime-fab ${buttonStatus} ${collapsed ? 'collapsed' : 'expanded'} ${justArmed ? 'attention-fresh' : ''} ${justCompleted ? 'completed-fresh' : ''}`}
            aria-label={buttonLabel}
            title={buttonLabel}
            aria-pressed={!collapsed}
            onClick={(event) => {
              runImpactAction(onToggleCollapsed, { element: event.currentTarget });
            }}
          >
            <span className="task-runtime-fab-icon" aria-hidden="true">
              <span className={`task-runtime-fab-icon-orbit ${task?.status === 'running' || !task ? 'spinning' : ''}`}>
                <Icon name={buttonIcon} size={buttonIcon === 'task' ? 21 : 16} />
              </span>
            </span>
          </button>
        ) : null}
        {showJumpToTop ? <JumpToTop onClick={onJumpToTop} className="chat-floating-jump-btn" /> : null}
        {showJumpToLatest ? <JumpToLatest onClick={onJumpToLatest} className="chat-floating-jump-btn" /> : null}
      </div>
    </div>
  );
}
