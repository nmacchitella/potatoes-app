'use client';

import Image from 'next/image';

interface UserAvatarProps {
  user: {
    name?: string;
    profile_image_url?: string | null;
  } | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallbackIcon?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-24 h-24 text-3xl',
};

export default function UserAvatar({
  user,
  size = 'md',
  className = '',
  showFallbackIcon = false,
}: UserAvatarProps) {
  const sizeClass = sizeClasses[size];

  return (
    <div
      className={`relative rounded-full bg-cream-dark border border-border flex items-center justify-center overflow-hidden flex-shrink-0 ${sizeClass} ${className}`}
    >
      {user?.profile_image_url ? (
        <Image
          src={user.profile_image_url}
          alt={user.name || 'User'}
          fill
          sizes="(max-width: 768px) 48px, 48px"
          className="object-cover"
        />
      ) : showFallbackIcon ? (
        <svg className="w-1/2 h-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ) : (
        <span className="font-serif text-charcoal">
          {user?.name?.charAt(0).toUpperCase() || '?'}
        </span>
      )}
    </div>
  );
}
