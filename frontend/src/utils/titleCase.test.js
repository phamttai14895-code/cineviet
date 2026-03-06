import { describe, it, expect } from 'vitest';
import { toTitleCase } from './titleCase.js';

describe('toTitleCase', () => {
  it('viết hoa chữ cái đầu mỗi từ', () => {
    expect(toTitleCase('PHIM HAY NHẤT')).toBe('Phim Hay Nhất');
    expect(toTitleCase('one piece')).toBe('One Piece');
  });

  it('trả về chuỗi rỗng khi null/undefined/không phải string', () => {
    expect(toTitleCase(null)).toBe('');
    expect(toTitleCase(undefined)).toBe('');
    expect(toTitleCase(123)).toBe('');
  });

  it('trim và xử lý khoảng trắng', () => {
    expect(toTitleCase('  hello world  ')).toBe('Hello World');
  });

  it('giữ nguyên chuỗi rỗng', () => {
    expect(toTitleCase('')).toBe('');
    expect(toTitleCase('   ')).toBe('');
  });
});
