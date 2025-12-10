'use client';

interface LoadingSkeletonProps {
  variant?: 'card' | 'list' | 'text' | 'avatar' | 'image';
  count?: number;
  className?: string;
}

export default function LoadingSkeleton({
  variant = 'card',
  count = 1,
  className = '',
}: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'avatar') {
    return (
      <div className={`animate-pulse ${className}`}>
        {items.map((i) => (
          <div key={i} className="w-10 h-10 rounded-full bg-cream-dark" />
        ))}
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={`animate-pulse space-y-2 ${className}`}>
        {items.map((i) => (
          <div key={i} className="h-4 bg-cream-dark rounded w-full" />
        ))}
      </div>
    );
  }

  if (variant === 'image') {
    return (
      <div className={`animate-pulse ${className}`}>
        {items.map((i) => (
          <div key={i} className="aspect-[4/3] bg-cream-dark rounded-lg" />
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`animate-pulse space-y-3 ${className}`}>
        {items.map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cream-dark" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-cream-dark rounded w-3/4" />
              <div className="h-3 bg-cream-dark rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default: card variant
  return (
    <div className={`animate-pulse space-y-4 ${className}`}>
      {items.map((i) => (
        <div key={i} className="bg-white rounded-lg border border-border p-4">
          <div className="h-32 bg-cream-dark rounded-lg mb-3" />
          <div className="h-4 bg-cream-dark rounded w-3/4 mb-2" />
          <div className="h-3 bg-cream-dark rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
