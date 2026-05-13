import { memo, useEffect, useState, type ReactNode } from 'react';

export interface EntityAvatarProps {
  imagePath?: string | null;
  /** Shown while loading or when no image */
  fallback: ReactNode;
  alt?: string;
  className?: string;
}

function EntityAvatarInner({ imagePath, fallback, alt = '', className = '' }: EntityAvatarProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setImageUrl(null);
    if (!imagePath || !window.electronAPI?.fileGetImageUrl) return;
    let cancelled = false;
    window.electronAPI.fileGetImageUrl(imagePath).then((r) => {
      if (!cancelled && r?.success && r?.url) setImageUrl(r.url);
    });
    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  if (imageUrl) {
    return <img src={imageUrl} alt={alt} className={className} />;
  }
  return <>{fallback}</>;
}

/**
 * Resolves `fileGetImageUrl` for entity/employee/vehicle photos with a stable fallback icon.
 * Re-renders only when `imagePath` / `alt` / `className` change (fallback node identity is ignored).
 */
export const EntityAvatar = memo(EntityAvatarInner, (prev, next) => {
  return (
    prev.imagePath === next.imagePath &&
    prev.alt === next.alt &&
    prev.className === next.className
  );
});
