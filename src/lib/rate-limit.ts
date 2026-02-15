// ============================================
// RATE LIMITING SERVICE
// ============================================
// In-memory rate limiting for API protection
// For production, consider using Redis (Upstash) for distributed rate limiting

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  blockDurationMs: number; // How long to block after limit exceeded
}

// In-memory store (resets on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now && !entry.blocked) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

// ============================================
// RATE LIMIT PRESETS
// ============================================

export const rateLimitPresets = {
  // Strict: For authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000,    // 15 minutes
    maxRequests: 5,               // 5 requests per 15 minutes
    blockDurationMs: 30 * 60 * 1000, // 30 minutes block
  },

  // Moderate: For API writes
  api: {
    windowMs: 60 * 1000,          // 1 minute
    maxRequests: 30,              // 30 requests per minute
    blockDurationMs: 5 * 60 * 1000, // 5 minutes block
  },

  // Relaxed: For API reads
  read: {
    windowMs: 60 * 1000,          // 1 minute
    maxRequests: 100,             // 100 requests per minute
    blockDurationMs: 60 * 1000,   // 1 minute block
  },

  // Very strict: For password reset, etc.
  sensitive: {
    windowMs: 60 * 60 * 1000,     // 1 hour
    maxRequests: 3,               // 3 requests per hour
    blockDurationMs: 24 * 60 * 60 * 1000, // 24 hours block
  },

  // Webhook: For external webhooks
  webhook: {
    windowMs: 60 * 1000,          // 1 minute
    maxRequests: 1000,            // 1000 requests per minute
    blockDurationMs: 60 * 1000,   // 1 minute block
  },
};

// ============================================
// RATE LIMITER CLASS
// ============================================

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = rateLimitPresets.api) {
    this.config = config;
  }

  /**
   * Check if a key is rate limited
   * Returns { allowed, remaining, resetTime, retryAfter }
   */
  check(key: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter: number;
    blocked: boolean;
  } {
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    // Check if blocked
    if (entry?.blocked && entry.resetTime > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        blocked: true,
      };
    }

    // Check if window expired
    if (!entry || entry.resetTime < now) {
      // Start new window
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + this.config.windowMs,
        blocked: false,
      };
      rateLimitStore.set(key, newEntry);

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: newEntry.resetTime,
        retryAfter: 0,
        blocked: false,
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      // Block the key
      entry.blocked = true;
      entry.resetTime = now + this.config.blockDurationMs;

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        blocked: true,
      };
    }

    // Increment count
    entry.count++;
    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
      retryAfter: 0,
      blocked: false,
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    rateLimitStore.delete(key);
  }

  /**
   * Get current rate limit status for a key
   */
  getStatus(key: string): {
    count: number;
    remaining: number;
    resetTime: number;
    blocked: boolean;
  } | null {
    const entry = rateLimitStore.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (entry.resetTime < now && !entry.blocked) return null;

    return {
      count: entry.count,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      blocked: entry.blocked,
    };
  }
}

// ============================================
// PRE-CONFIGURED RATE LIMITERS
// ============================================

export const rateLimiters = {
  auth: new RateLimiter(rateLimitPresets.auth),
  api: new RateLimiter(rateLimitPresets.api),
  read: new RateLimiter(rateLimitPresets.read),
  sensitive: new RateLimiter(rateLimitPresets.sensitive),
  webhook: new RateLimiter(rateLimitPresets.webhook),
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
  // Check various headers for IP
  const headers = request.headers;
  
  // Vercel / Cloudflare
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Cloudflare specific
  const cfIP = headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }

  // AWS / GCP
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback
  return 'unknown';
}

/**
 * Create rate limit key with IP and optional user ID
 */
export function createRateLimitKey(
  identifier: string,
  ip?: string,
  userId?: string
): string {
  const parts = [identifier];
  if (userId) parts.push(`user:${userId}`);
  if (ip) parts.push(`ip:${ip}`);
  return parts.join(':');
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(
  remaining: number,
  resetTime: number,
  limit: number
): Headers {
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', String(limit));
  headers.set('X-RateLimit-Remaining', String(remaining));
  headers.set('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));
  return headers;
}

// Default export
export default rateLimiters;
