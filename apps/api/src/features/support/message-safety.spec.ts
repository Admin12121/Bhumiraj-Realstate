import { inspectMessage } from './message-safety';

describe('support message safety', () => {
  it('passes an ordinary enquiry', () => {
    expect(
      inspectMessage('Do you have any 3 bedroom houses in Lalitpur?')
        .flaggedReason,
    ).toBeNull();
  });

  it('flags a request for credentials', () => {
    expect(
      inspectMessage('Send me the OTP you just received').flaggedReason,
    ).toContain('credential request');
  });

  it('flags off-platform payment rails', () => {
    expect(
      inspectMessage('Pay the booking fee to my eSewa account').flaggedReason,
    ).toContain('payment details');
  });

  it('flags links', () => {
    expect(
      inspectMessage('Check https://not-bhumiraj.example for photos')
        .flaggedReason,
    ).toContain('link');
  });

  it('flags a Nepali mobile number in either format', () => {
    expect(inspectMessage('Call me on 9812345678').flaggedReason).toContain(
      'phone number',
    );
    expect(inspectMessage('Call me on +977 9812345678').flaggedReason).toContain(
      'phone number',
    );
  });

  it('flags an email address', () => {
    expect(
      inspectMessage('Write to me at seller@example.com').flaggedReason,
    ).toContain('email address');
  });

  it('flags character floods', () => {
    expect(
      inspectMessage(`hello${'!'.repeat(40)}`).flaggedReason,
    ).toContain('repeated characters');
  });

  it('flags a wall of emoji but allows a few', () => {
    expect(inspectMessage('Thanks! 🙏🏠').flaggedReason).toBeNull();
    expect(inspectMessage('🎉'.repeat(40)).flaggedReason).toContain(
      'repeated characters',
    );
  });

  it('reports every reason that applies', () => {
    const reason = inspectMessage(
      'Send the OTP to seller@example.com or call 9812345678',
    ).flaggedReason;
    expect(reason).toContain('credential request');
    expect(reason).toContain('email address');
    expect(reason).toContain('phone number');
  });
});
