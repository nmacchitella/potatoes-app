'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { UserAvatar } from '@/components/ui';

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useStore();

  // Don't show on certain pages
  const hideOnPaths = ['/auth/login', '/register', '/r/'];
  const shouldHide = hideOnPaths.some(path => pathname.startsWith(path));

  if (shouldHide) return null;

  const isHome = pathname === '/' || pathname.startsWith('/?');

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40 md:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.05)]" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center justify-around h-14 px-4">
        {/* Left - Home/Recipes */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-colors ${
            isHome
              ? 'text-gold'
              : 'text-warm-gray hover:text-charcoal'
          }`}
          aria-label="Home"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] mt-0.5">Home</span>
        </Link>

        {/* Center - Oversized Add Button */}
        <Link
          href="/recipes/new"
          className="relative -mt-5 flex items-center justify-center w-14 h-14 bg-gold hover:bg-gold-dark rounded-full shadow-lg transition-all active:scale-95"
          aria-label="Add new recipe"
        >
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </Link>

        {/* Right - Profile */}
        <Link
          href={`/profile/${user?.id || ''}`}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-colors ${
            pathname.startsWith('/profile')
              ? 'text-gold'
              : 'text-warm-gray hover:text-charcoal'
          }`}
          aria-label="Profile"
        >
          <UserAvatar user={user} size="sm" showFallbackIcon />
          <span className="text-[10px] mt-0.5">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
