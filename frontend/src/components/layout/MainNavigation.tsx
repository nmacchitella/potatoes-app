'use client';

import Link from 'next/link';

type NavItem = 'recipes' | 'calendar' | 'grocery' | 'ingredients';

interface MainNavigationProps {
  currentPage: NavItem;
}

const NAV_ITEMS: { id: NavItem; label: string; href: string; icon: React.ReactNode }[] = [
  {
    id: 'recipes',
    label: 'Recipes',
    href: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'calendar',
    label: 'Meal Plan',
    href: '/calendar',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'grocery',
    label: 'Grocery List',
    href: '/grocery',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'ingredients',
    label: 'Ingredients',
    href: '/ingredients',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
];

export default function MainNavigation({ currentPage }: MainNavigationProps) {
  return (
    <div className="space-y-1 mb-4 pb-4 border-b border-border">
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === currentPage;

        if (isActive) {
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left bg-gold/10 text-gold-dark font-medium"
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          );
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors text-charcoal hover:bg-cream-dark"
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
