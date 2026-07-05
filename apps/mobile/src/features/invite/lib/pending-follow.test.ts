import { consumePendingFollow, parseFollowUrl, setPendingFollow } from './pending-follow';

describe('parseFollowUrl', () => {
  it('extracts the id from a vouch://follow?id=<userId> scheme link', () => {
    expect(parseFollowUrl('vouch://follow?id=abc-123')).toBe('abc-123');
  });

  it('extracts the id from an https web follow link with extra params', () => {
    expect(parseFollowUrl('https://vouch.app/follow?ref=wa&id=u_42')).toBe('u_42');
  });

  it('URL-decodes the id', () => {
    expect(parseFollowUrl('vouch://follow?id=a%20b')).toBe('a b');
  });

  it('returns null for non-follow links', () => {
    expect(parseFollowUrl('vouch://list/abc?id=xyz')).toBeNull();
    expect(parseFollowUrl('https://example.com/?id=xyz')).toBeNull();
  });

  it('returns null when there is no id param', () => {
    expect(parseFollowUrl('vouch://follow')).toBeNull();
    expect(parseFollowUrl('vouch://follow?ref=wa')).toBeNull();
  });

  it('returns null for empty / nullish input', () => {
    expect(parseFollowUrl('')).toBeNull();
    expect(parseFollowUrl(null)).toBeNull();
    expect(parseFollowUrl(undefined)).toBeNull();
  });
});

describe('pending-follow stash', () => {
  it('consumePendingFollow returns null when nothing is pending', () => {
    // Drain first in case a prior test left something.
    consumePendingFollow();
    expect(consumePendingFollow()).toBeNull();
  });

  it('set then consume returns the id once, then clears', () => {
    setPendingFollow('inviter-1');
    expect(consumePendingFollow()).toBe('inviter-1');
    expect(consumePendingFollow()).toBeNull();
  });
});
