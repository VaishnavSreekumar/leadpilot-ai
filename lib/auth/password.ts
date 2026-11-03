import 'server-only';
import crypto from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Hashes a plaintext password using PBKDF2 with SHA-512 and a random salt.
 * Format returned: <salt-hex>:<derived-key-hex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha512');
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored <salt-hex>:<derived-key-hex> hash
 * using constant-time timingSafeEqual to prevent timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, expectedKeyHex] = parts;
    const expectedKey = Buffer.from(expectedKeyHex, 'hex');
    const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, expectedKey.length, 'sha512');
    return crypto.timingSafeEqual(expectedKey, derivedKey);
  } catch {
    return false;
  }
}

