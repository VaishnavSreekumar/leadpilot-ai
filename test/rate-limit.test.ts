import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/db';
import { checkRateLimit, getClientIp, isValidIp } from '../lib/security/rate-limit';

describe('PostgreSQL Atomic Rate Limiting', () => {
  const TEST_KEY = 'test_ratelimit_key_' + Date.now();

  afterAll(async () => {
    await prisma.rateLimit.deleteMany({
      where: { key: { startsWith: 'test_ratelimit_' } },
    });
  });

  it('allows requests within limit and tracks remaining', async () => {
    const res1 = await checkRateLimit({
      key: TEST_KEY,
      maxRequests: 3,
      windowSeconds: 5,
    });

    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = await checkRateLimit({
      key: TEST_KEY,
      maxRequests: 3,
      windowSeconds: 5,
    });

    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = await checkRateLimit({
      key: TEST_KEY,
      maxRequests: 3,
      windowSeconds: 5,
    });

    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);

    // 4th request exceeds limit
    const res4 = await checkRateLimit({
      key: TEST_KEY,
      maxRequests: 3,
      windowSeconds: 5,
    });

    expect(res4.success).toBe(false);
    expect(res4.remaining).toBe(0);
    expect(res4.retryAfterSeconds).toBeGreaterThan(0);
  }, 25000);

  it('atomically handles concurrent requests without race condition bypass', async () => {
    const CONCURRENT_KEY = 'test_ratelimit_concurrent_' + Date.now();
    const MAX = 5;

    // Send 10 simultaneous requests
    const promises = Array.from({ length: 10 }).map(() =>
      checkRateLimit({
        key: CONCURRENT_KEY,
        maxRequests: MAX,
        windowSeconds: 5,
      })
    );

    const results = await Promise.all(promises);
    const allowed = results.filter((r) => r.success);
    const rejected = results.filter((r) => !r.success);

    expect(allowed.length).toBe(MAX);
    expect(rejected.length).toBe(5);
  }, 25000);

  describe('Trusted Proxy IP Resolution & Spoofing Resistance', () => {
    it('prioritizes edge-verified x-real-ip header over client-controlled headers', () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        headers: {
          'x-forwarded-for': '198.51.100.1, 10.0.0.1',
          'x-real-ip': '203.0.113.50',
        },
      });

      expect(getClientIp(req)).toBe('203.0.113.50');
    });

    it('prioritizes cf-connecting-ip if x-real-ip is absent', () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        headers: {
          'cf-connecting-ip': '198.51.100.99',
          'x-forwarded-for': 'attacker-spoofed-ip, 10.0.0.1',
        },
      });

      expect(getClientIp(req)).toBe('198.51.100.99');
    });

    it('extracts rightmost proxy hop from x-forwarded-for when edge headers are absent', () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        headers: {
          'x-forwarded-for': 'spoofed.attacker.ip, 192.0.2.45',
        },
      });

      expect(getClientIp(req)).toBe('192.0.2.45');
    });

    it('falls back to 127.0.0.1 for missing or malformed headers', () => {
      const reqNoHeaders = new Request('http://localhost:3000/api/auth/login');
      expect(getClientIp(reqNoHeaders)).toBe('127.0.0.1');

      const reqMalformed = new Request('http://localhost:3000/api/auth/login', {
        headers: { 'x-real-ip': '<script>alert(1)</script>' },
      });
      expect(getClientIp(reqMalformed)).toBe('127.0.0.1');
    });

    it('validates IPv4 and IPv6 syntax correctly', () => {
      expect(isValidIp('192.168.1.1')).toBe(true);
      expect(isValidIp('::1')).toBe(true);
      expect(isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
      expect(isValidIp('999.999.999.999')).toBe(false);
      expect(isValidIp('not-an-ip')).toBe(false);
    });
  });
});

