import { forwardRef, type ReactNode } from 'react';
import { Icon, type IconName } from '../../Icon';
import { CreateActionSheet } from '../../create/CreateActionSheet';
import { runImpactAction } from '../../haptics';

type CollectionFloatingCreateActionProps = {
  label: string;
  icon?: IconName;
  expanded?: boolean;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  onPress: () => void;
};

export const CollectionFloatingCreateAction = forwardRef<HTMLDivElement, CollectionFloatingCreateActionProps>(
  function CollectionFloatingCreateAction({
    label,
    icon = 'plus',
    expanded = false,
    disabled = false,
    className,
    children,
    onPress
  }, ref) {
    return (
      <div
        ref={ref}
        className={[
          'collection-floating-create-anchor',
          expanded ? 'collection-floating-create-anchor--open' : null,
          disabled ? 'collection-floating-create-anchor--disabled' : null,
          className
        ].filter(Boolean).join(' ')}
      >
        {children ? (
          <CreateActionSheet
            open={expanded}
            ariaLabel={label}
            className="collection-create-action-sheet"
            onClose={onPress}
          >
            {children}
          </CreateActionSheet>
        ) : null}
        <button
          type="button"
          className="collection-floating-create-fab"
          aria-label={label}
          aria-expanded={children ? expanded : undefined}
          disabled={disabled}
          onClick={(event) => {
            if (disabled) return;
            runImpactAction(onPress, { element: event.currentTarget });
          }}
        >
          <Icon name={expanded ? 'x' : icon} size={16} />
        </button>
      </div>
    );
  }
);
