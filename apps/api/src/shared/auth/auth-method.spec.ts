import {
  assertionUserVerified,
  classifyAuthMethod,
  isStrongAuthMethod,
} from '@real-estate/auth/method';

/** Builds authenticator data with the requested flag byte at offset 32. */
function authenticatorData(flags: number): string {
  const bytes = Buffer.alloc(37);
  bytes[32] = flags;
  return bytes.toString('base64url');
}

const USER_PRESENT = 0x01;
const USER_VERIFIED = 0x04;

describe('assertionUserVerified', () => {
  it('detects a user-verified assertion', () => {
    expect(
      assertionUserVerified(authenticatorData(USER_PRESENT | USER_VERIFIED)),
    ).toBe(true);
  });

  it('detects a presence-only assertion', () => {
    expect(assertionUserVerified(authenticatorData(USER_PRESENT))).toBe(false);
  });

  it('returns undefined when the flag cannot be read', () => {
    expect(assertionUserVerified(undefined)).toBeUndefined();
    expect(assertionUserVerified('')).toBeUndefined();
    expect(assertionUserVerified('too-short')).toBeUndefined();
  });
});

describe('classifyAuthMethod', () => {
  it('treats a passkey without user verification as a weaker method', () => {
    expect(
      classifyAuthMethod('/passkey/verify-authentication', {
        userVerified: false,
      }),
    ).toBe('passkey-unverified');
    expect(
      classifyAuthMethod('/passkey/verify-authentication', {
        userVerified: true,
      }),
    ).toBe('passkey');
  });

  it('classifies the remaining sign-in routes', () => {
    expect(classifyAuthMethod('/two-factor/verify-totp')).toBe(
      'credential+2fa',
    );
    expect(classifyAuthMethod('/two-factor/verify-backup-code')).toBe(
      'credential+2fa',
    );
    expect(classifyAuthMethod('/sign-in/email')).toBe('credential');
    expect(classifyAuthMethod('/callback/google')).toBe('social');
    expect(classifyAuthMethod('/something/unmapped')).toBe('unknown');
  });
});

describe('isStrongAuthMethod', () => {
  it('accepts only methods proving more than one factor', () => {
    expect(isStrongAuthMethod('credential+2fa')).toBe(true);
    expect(isStrongAuthMethod('passkey')).toBe(true);
    expect(isStrongAuthMethod('passkey-unverified')).toBe(false);
    expect(isStrongAuthMethod('credential')).toBe(false);
    expect(isStrongAuthMethod('social')).toBe(false);
    expect(isStrongAuthMethod(null)).toBe(false);
  });
});
