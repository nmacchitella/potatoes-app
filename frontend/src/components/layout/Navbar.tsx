'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/store/useStore';
import NotificationBell from '@/components/notifications/NotificationBell';

export default function Navbar() {
  const pathname = usePathname();
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

  const isActive = (path: string) => pathname === path;

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/recipes', label: 'Recipes' },
    { href: '/feed', label: 'Feed' },
  ];

  return (
    <nav className="bg-dark-card border-b border-dark-hover sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <span>Potatoes</span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors ${
                  isActive(link.href)
                    ? 'text-primary font-medium'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
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
                <div className="w-8 h-8 rounded-full bg-dark-hover flex items-center justify-center overflow-hidden">
                  {user?.profile_image_url ? (
                    <img
                      src={user.profile_image_url}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm">
                      {user?.name?.charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
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
                <div className="absolute right-0 mt-2 w-48 bg-dark-card rounded-lg shadow-xl border border-dark-hover py-1">
                  <div className="px-4 py-2 border-b border-dark-hover">
                    <p className="font-medium truncate">{user?.name}</p>
                    <p className="text-sm text-gray-400 truncate">
                      {user?.username ? `@${user.username}` : user?.email}
                    </p>
                  </div>

                  <Link
                    href={`/profile/${user?.username || user?.id}`}
                    className="block px-4 py-2 text-sm hover:bg-dark-hover transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Your Profile
                  </Link>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm hover:bg-dark-hover transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <Link
                    href="/collections"
                    className="block px-4 py-2 text-sm hover:bg-dark-hover transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Collections
                  </Link>

                  <div className="border-t border-dark-hover mt-1 pt-1">
                    <button
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-dark-hover transition-colors"
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

      {/* Mobile Nav */}
      <div className="md:hidden border-t border-dark-hover">
        <div className="flex justify-around py-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 text-sm transition-colors ${
                isActive(link.href)
                  ? 'text-primary font-medium'
                  : 'text-gray-400'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
