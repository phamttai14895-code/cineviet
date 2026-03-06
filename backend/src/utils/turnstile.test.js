import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isTurnstileEnabled } from './turnstile.js';

const origSecret = process.env.TURNSTILE_SECRET;

function restore() {
  process.env.TURNSTILE_SECRET = origSecret;
}

describe('isTurnstileEnabled', () => {
  it('trả về false khi TURNSTILE_SECRET trống', () => {
    try {
      process.env.TURNSTILE_SECRET = '';
      assert.strictEqual(isTurnstileEnabled(), false);
      process.env.TURNSTILE_SECRET = '   ';
      assert.strictEqual(isTurnstileEnabled(), false);
    } finally {
      restore();
    }
  });

  it('trả về false khi TURNSTILE_SECRET là "undefined" hoặc "false"', () => {
    try {
      process.env.TURNSTILE_SECRET = 'undefined';
      assert.strictEqual(isTurnstileEnabled(), false);
      process.env.TURNSTILE_SECRET = 'false';
      assert.strictEqual(isTurnstileEnabled(), false);
    } finally {
      restore();
    }
  });

  it('trả về true khi TURNSTILE_SECRET có giá trị', () => {
    try {
      process.env.TURNSTILE_SECRET = 'sk-secret-key';
      assert.strictEqual(isTurnstileEnabled(), true);
    } finally {
      restore();
    }
  });
});
