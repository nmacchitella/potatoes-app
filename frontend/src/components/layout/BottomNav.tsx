'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/store/useStore';

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useStore();

  // Don't show on certain pages
  const hideOnPaths = ['/login', '/register', '/r/'];
  const shouldHide = hideOnPaths.some(path => pathname.startsWith(path));

  if (shouldHide) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-cream border-t border-border z-40 md:hidden pb-safe">
      <div className="flex items-center justify-around h-16 px-4">
        {/* Left slot - empty for now */}
        <div className="w-12" />

        {/* Center - Oversized Add Button */}
        <Link
          href="/recipes/new"
          className="relative -mt-6 flex items-center justify-center w-14 h-14 bg-gold hover:bg-gold-dark rounded-full shadow-lg transition-all active:scale-95"
          aria-label="Add new recipe"
        >
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </Link>

        {/* Right - Profile */}
        <Link
          href={`/profile/${user?.username || user?.id || ''}`}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-colors ${
            pathname.startsWith('/profile')
              ? 'text-gold'
              : 'text-warm-gray hover:text-charcoal'
          }`}
          aria-label="Profile"
        >
          <div className="w-7 h-7 rounded-full bg-cream-dark border border-border flex items-center justify-center overflow-hidden">
            {user?.profile_image_url ? (
              <img
                src={user.profile_image_url}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
        </Link>
      </div>
    </nav>
  );
}
