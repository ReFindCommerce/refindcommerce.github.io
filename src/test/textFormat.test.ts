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
});
