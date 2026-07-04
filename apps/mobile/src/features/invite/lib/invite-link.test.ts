import { INVITE_URL, buildFollowLink, buildPersonalInviteText } from './invite-link';

describe('buildFollowLink', () => {
  it('emits a lore://follow?id=<userId> scheme link while INVITE_URL is empty', () => {
    // Guard: this test encodes the current pre-launch state.
    expect(INVITE_URL).toBe('');
    expect(buildFollowLink('user-42')).toBe('lore://follow?id=user-42');
  });

  it('URL-encodes the user id', () => {
    expect(buildFollowLink('a b/c')).toBe('lore://follow?id=a%20b%2Fc');
  });
});

describe('buildPersonalInviteText', () => {
  it('includes a follow link carrying the inviter id when signed in', () => {
    const text = buildPersonalInviteText('me-1');
    expect(text).toContain('lore://follow?id=me-1');
    expect(text).toContain('places i actually love');
  });

  it('falls back to link-free copy when there is no user id', () => {
    const text = buildPersonalInviteText(null);
    expect(text).not.toContain('follow?id=');
    expect(text).toContain('places i actually love');
  });
});
