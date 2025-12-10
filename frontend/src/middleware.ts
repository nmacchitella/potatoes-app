import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = [
  '/',                      // Landing page (handles its own redirect for logged-in users)
  '/auth/login',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verification-required',
  '/auth/callback',
];

// Route prefixes that are public (share pages, etc.)
const publicPrefixes = [
  '/r/',                    // Public recipe share links (/r/[id])
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check exact match for public routes
  const isPublicRoute = publicRoutes.includes(pathname);

  // Check prefix match for public route prefixes (e.g., /r/abc123)
  const isPublicPrefix = publicPrefixes.some(prefix => pathname.startsWith(prefix));

  if (isPublicRoute || isPublicPrefix) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // Has valid access token - proceed
  if (accessToken) {
    return NextResponse.next();
  }

  // No access token but has refresh token - let client handle refresh
  // The AuthProvider will attempt to refresh on load
  if (refreshToken) {
    return NextResponse.next();
  }

  // No tokens at all - redirect to login
  const loginUrl = new URL('/auth/login', request.url);
  loginUrl.searchParams.set('returnUrl', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
