import { describe, it, expect } from 'vitest';
import {
  generateId,
  generateApiKey,
  generateErrorSignature,
  maskEmail,
  maskPhone,
  truncate,
} from '../utils';

describe('Utils', () => {
  describe('generateId', () => {
    it('should generate ID with prefix', () => {
      const id = generateId('user');
      expect(id).toMatch(/^user_[a-zA-Z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId('test')));
      expect(ids.size).toBe(100);
    });
  });

  describe('generateApiKey', () => {
    it('should generate key with rly prefix', () => {
      const key = generateApiKey();
      expect(key).toMatch(/^rly_[a-zA-Z0-9]+$/);
    });
  });

  describe('generateErrorSignature', () => {
    it('should generate consistent signature for same error', () => {
      const error = {
        message: 'Cannot read property "foo" of undefined',
        stack: `TypeError: Cannot read property "foo" of undefined
    at handleClick (app.js:123:45)
    at onClick (react.js:100:10)`,
      };

      const sig1 = generateErrorSignature(error);
      const sig2 = generateErrorSignature(error);

      expect(sig1).toBe(sig2);
    });

    it('should handle missing stack', () => {
      const error = { message: 'Simple error' };
      const sig = generateErrorSignature(error);
      expect(sig).toBeTruthy();
    });
  });

  describe('maskEmail', () => {
    it('should mask standard email', () => {
      expect(maskEmail('test@example.com')).toBe('t***@e***.com');
    });

    it('should handle short local parts', () => {
      expect(maskEmail('a@b.com')).toBe('a***@b***.com');
    });
  });

  describe('maskPhone', () => {
    it('should mask US phone number', () => {
      expect(maskPhone('555-123-4567')).toBe('***-***-4567');
    });

    it('should handle various formats', () => {
      expect(maskPhone('5551234567')).toBe('******4567');
    });
  });

  describe('truncate', () => {
    it('should not truncate short strings', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('should truncate long strings with ellipsis', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
    });

    it('should handle exact length', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });

    it('should handle empty string', () => {
      expect(truncate('', 10)).toBe('');
    });
  });
});
