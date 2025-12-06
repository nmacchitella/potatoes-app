'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Redirect from /users/[username] to /profile/[username]
 * This ensures backwards compatibility and consistent URL handling
 */
export default function UserRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  useEffect(() => {
    router.replace(`/profile/${username}`);
  }, [router, username]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-warm-gray">Redirecting...</div>
    </div>
  );
}
