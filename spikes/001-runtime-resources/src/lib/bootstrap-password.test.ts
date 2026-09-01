import { describe, expect, it } from 'vitest';
import { createBootstrapPassword } from './bootstrap-password';

describe('createBootstrapPassword', () => {
  it('creates a fresh high-entropy URL-safe value for one-time enrollment', () => {
    const first = createBootstrapPassword();
    const second = createBootstrapPassword();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });
});
