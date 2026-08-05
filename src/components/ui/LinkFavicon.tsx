import { faviconUrl, LINK_FALLBACK_ICON } from '../../utils/favicon';

interface LinkFaviconProps {
  url: string;
  size?: number;
  className?: string;
}

export function LinkFavicon({ url, size = 16, className }: LinkFaviconProps) {
  const src = faviconUrl(url, Math.max(32, size * 2)) || LINK_FALLBACK_ICON;
  return (
    <img
      src={src}
      alt=""
      className={`link-favicon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = LINK_FALLBACK_ICON; }}
    />
  );
}
