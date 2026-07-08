import { INVITE_URL, buildFollowLink, buildPersonalInviteText } from './invite-link';

describe('buildFollowLink', () => {
  it('hangs ?id=<userId> off the stable invite-redirect URL', () => {
    // Guard: INVITE_URL must point at the redirect function, not a raw
    // build artifact URL (those change every release — see invite-link.ts's
    // header comment for why a direct artifact link is the wrong target).
    expect(INVITE_URL).toContain('/functions/v1/invite-redirect');
    expect(buildFollowLink('user-42')).toBe(`${INVITE_URL}?id=user-42`);
  });

  it('URL-encodes the user id', () => {
    expect(buildFollowLink('a b/c')).toBe(`${INVITE_URL}?id=a%20b%2Fc`);
  });
});

describe('buildPersonalInviteText', () => {
  it('includes a follow link carrying the inviter id when signed in', () => {
    const text = buildPersonalInviteText('me-1');
    expect(text).toContain(`${INVITE_URL}?id=me-1`);
    expect(text).toContain('places i actually love');
  });

  it('falls back to the bare install link (no id) when there is no user id', () => {
    const text = buildPersonalInviteText(null);
    expect(text).not.toContain('id=');
    expect(text).toContain(INVITE_URL);
    expect(text).toContain('places i actually love');
  });
});
