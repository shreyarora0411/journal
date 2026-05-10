import { describe, expect, it } from 'vitest';
import { HandleSchema, VisibilitySchema } from './index';

describe('VisibilitySchema', () => {
  it('accepts the three valid values', () => {
    expect(VisibilitySchema.parse('followers')).toBe('followers');
    expect(VisibilitySchema.parse('friends_of_friends')).toBe('friends_of_friends');
    expect(VisibilitySchema.parse('everyone')).toBe('everyone');
  });

  it('rejects unknown values', () => {
    expect(() => VisibilitySchema.parse('public')).toThrow();
  });
});

describe('HandleSchema', () => {
  it('accepts valid handles', () => {
    expect(HandleSchema.parse('shrey')).toBe('shrey');
    expect(HandleSchema.parse('shrey_arora_01')).toBe('shrey_arora_01');
  });

  it('rejects handles with uppercase or punctuation', () => {
    expect(() => HandleSchema.parse('Shrey')).toThrow();
    expect(() => HandleSchema.parse('shrey.arora')).toThrow();
    expect(() => HandleSchema.parse('a')).toThrow();
  });
});
