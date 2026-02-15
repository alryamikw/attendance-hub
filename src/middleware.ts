// ============================================
// RATE LIMITING MIDDLEWARE
// ============================================
// Protects API routes from abuse

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimiters, getClientIP, createRateLimitKey, createRateLimitHeaders } from '@/lib/rate-limit';

// Routes and their rate limit configurations
const routeConfig: Record<string, keyof typeof rateLimiters> = {
  '/api/auth/login': 'auth',
  '/api/auth/register': 'auth',
  '/api/auth/logout': 'api',
  '/api/attendance': 'api',
  '/api/employees': 'api',
  '/api/branches': 'api',
  '/api/dashboard': 'read',
  '/api/reports': 'read',
  '/api/payroll': 'read',
  '/api/timeoff': 'api',
  '/api/export': 'api',
  '/api/notifications': 'api',
  '/api/face': 'api',
};

// Limit values for each preset
const presetLimits: Record<keyof typeof rateLimiters, number> = {
  auth: 5,
  api: 30,
  read: 100,
  sensitive: 3,
  webhook: 1000,
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Get the rate limit preset for this route
  const preset = routeConfig[pathname] || 'api';
  const limiter = rateLimiters[preset];

  // Get client identifier
  const ip = getClientIP(request);
  
  // Try to get user ID from authorization header
  const authHeader = request.headers.get('authorization');
  const userId = authHeader?.split(' ')[1] || undefined; // Simplified - in real app, decode JWT

  // Create rate limit key
  const key = createRateLimitKey(pathname, ip, userId);

  // Check rate limit
  const result = limiter.check(key);

  // Create response headers
  const headers = createRateLimitHeaders(
    result.remaining,
    result.resetTime,
    presetLimits[preset]
  );

  // If rate limited, return 429
  if (!result.allowed) {
    headers.set('Retry-After', String(result.retryAfter));
    
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests',
        message: result.blocked 
          ? 'Your access has been temporarily blocked due to excessive requests. Please try again later.'
          : 'Rate limit exceeded. Please slow down.',
        retryAfter: result.retryAfter,
      },
      { 
        status: 429,
        headers,
      }
    );
  }

  // Continue with request, adding rate limit headers
  const response = NextResponse.next();
  
  // Add rate limit info to response headers
  response.headers.set('X-RateLimit-Limit', String(presetLimits[preset]));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)));

  return response;
}

// Configure which routes use middleware
export const config = {
  matcher: [
    '/api/:path*',
  ],
};
