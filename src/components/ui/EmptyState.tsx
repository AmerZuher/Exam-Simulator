import { ReactNode } from 'react';
import { Icon, IconName } from '../../utils/icons';

interface EmptyStateProps {
  icon?: IconName;
  title?: string;
  desc?: string;
  actions?: ReactNode;
}

export function EmptyState({ icon = 'book', title = 'Nothing here yet', desc = '', actions }: EmptyStateProps) {
  return (
    <div className="empty rise">
      <div className="e-ico"><Icon name={icon} size={24} /></div>
      <div className="e-t">{title}</div>
      <div className="e-s">{desc}</div>
      {actions && <div className="e-actions">{actions}</div>}
    </div>
  );
}
