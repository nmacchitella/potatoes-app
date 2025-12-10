'use client';

interface RecipeImageProps {
  src?: string | null;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
};

const roundedClasses = {
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  full: 'rounded-full',
};

const iconSizes = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export default function RecipeImage({
  src,
  alt = '',
  size = 'sm',
  className = '',
  rounded = 'sm',
}: RecipeImageProps) {
  const sizeClass = sizeClasses[size];
  const roundedClass = roundedClasses[rounded];
  const iconSize = iconSizes[size];

  return (
    <div
      className={`bg-cream-dark flex-shrink-0 overflow-hidden flex items-center justify-center ${sizeClass} ${roundedClass} ${className}`}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <svg
          className={`text-warm-gray-light ${iconSize}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      )}
    </div>
  );
}
