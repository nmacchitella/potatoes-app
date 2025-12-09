'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Preserve query parameters when redirecting
    const params = searchParams.toString();
    router.replace(params ? `/?${params}` : '/');
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
    </div>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
      </div>
    }>
      <RedirectContent />
    </Suspense>
  );
}
