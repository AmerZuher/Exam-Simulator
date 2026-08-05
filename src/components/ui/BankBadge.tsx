import { Icon, IconName, BANK_ICONS, BANK_TONES } from '../../utils/icons';

interface BankBadgeProps {
  icon?: string;
  color?: string;
  logo?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  name?: string;
}

const SIZE_PX = { xs: 22, sm: 30, md: 38, lg: 62 };

function toneForName(name: string): (typeof BANK_TONES)[number] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % BANK_TONES.length;
  return BANK_TONES[h];
}

function iconForName(name: string): IconName {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i) * 7) % BANK_ICONS.length;
  return BANK_ICONS[h];
}

export function BankBadge({ icon, color, logo, size = 'md', name = '' }: BankBadgeProps) {
  const tone = color && BANK_TONES.includes(color as any) ? color : toneForName(name);
  const iconName = (icon as IconName) || iconForName(name);
  const px = SIZE_PX[size];

  return (
    <div
      className={`bank-badge ${size !== 'md' ? size : ''}${logo ? ' has-img' : ` tone-${tone}`}`.trim()}
      style={{ width: px, height: px }}
    >
      {logo ? (
        <img className="bank-badge-img" src={logo} alt="" draggable={false} />
      ) : (
        <Icon name={iconName} size={Math.round(px * 0.5)} strokeWidth={2} />
      )}
    </div>
  );
}
