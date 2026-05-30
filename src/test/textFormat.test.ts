import { describe, expect, it } from 'vitest';
import { cleanMessageText, formatSuggestedReply, normalizeCompactText, normalizeSearchText } from '@/lib/textFormat';

describe('text formatting helpers', () => {
  it('turns messy email html into searchable text', () => {
    const html = '<div>Hello&nbsp;Tom<br><style>.x{}</style><script>x()</script><p>Order &amp; return</p></div>';

    expect(cleanMessageText(html)).toBe('Hello Tom\nOrder & return');
    expect(normalizeSearchText(html)).toContain('order return');
  });

  it('supports compact phone and id matching', () => {
    expect(normalizeCompactText('+44 (0) 7700-900123')).toBe('4407700900123');
  });

  it('formats single-paragraph AI replies into readable sections', () => {
    const reply = 'Hello Tom, Yes, of course. You can find the manual here: https://example.com/manual If you need the other guide, it is here: https://example.com/guide Best wishes, Emily';

    expect(formatSuggestedReply(reply)).toBe([
      'Hello Tom,',
      '',
      'Yes, of course.',
      '',
      'You can find the manual here:',
      'https://example.com/manual',
      '',
      'If you need the other guide, it is here:',
      'https://example.com/guide',
      '',
      'Best wishes,',
      'Emily',
    ].join('\n'));
  });

  it('formats support replies with follow-up questions and sign-offs', () => {
    const reply = 'Hello Dr. Beckers, Thank you for reaching out and letting us know about the issue with your easyTag card. To help resolve this, could you please confirm whether your easyTag and phone are fully updated? Please could you also let us know information on the issue you are facing? What is the current device status on the app and the signs of disconnection? Once I have this information, I can assist you further with troubleshooting steps or next actions. Looking forward to your reply. Best wishes, Emily';

    expect(formatSuggestedReply(reply)).toBe([
      'Hello Dr. Beckers,',
      '',
      'Thank you for reaching out and letting us know about the issue with your easyTag card.',
      '',
      'To help resolve this, could you please confirm whether your easyTag and phone are fully updated?',
      '',
      'Please could you also let us know information on the issue you are facing?',
      '',
      'What is the current device status on the app and the signs of disconnection?',
      '',
      'Once I have this information, I can assist you further with troubleshooting steps or next actions.',
      '',
      'Looking forward to your reply.',
      '',
      'Best wishes,',
      'Emily',
    ].join('\n'));
  });
});
