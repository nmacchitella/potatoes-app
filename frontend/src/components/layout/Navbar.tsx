'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import NotificationBell from '@/components/notifications/NotificationBell';
import GlobalSearch, { CommandPalette } from '@/components/search/GlobalSearch';

export default function Navbar() {
  const { user, logout } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="bg-cream border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/recipes" className="font-serif text-2xl text-charcoal hover:text-gold transition-colors">
            Potatoes
          </Link>

          {/* Global Search */}
          <div className="flex-1 flex justify-center px-4">
            <GlobalSearch />
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            <NotificationBell />

            {/* User Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-9 h-9 rounded-full bg-cream-dark border border-border flex items-center justify-center overflow-hidden">
                  {user?.profile_image_url ? (
                    <img
                      src={user.profile_image_url}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-serif text-charcoal">
                      {user?.name?.charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-warm-gray transition-transform ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-border py-1">
                  <Link
                    href={`/profile/${user?.username || user?.id}`}
                    className="block px-4 py-3 border-b border-border hover:bg-cream transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <p className="font-medium text-charcoal truncate">{user?.name}</p>
                    <p className="text-sm text-warm-gray truncate">
                      {user?.username ? `@${user.username}` : user?.email}
                    </p>
                  </Link>

                  <Link
                    href="/recipes"
                    className="block px-4 py-2 text-sm text-charcoal hover:bg-cream transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    My Recipes
                  </Link>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-charcoal hover:bg-cream transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-cream transition-colors"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Command Palette (⌘K) */}
      <CommandPalette />
    </nav>
  );
}
