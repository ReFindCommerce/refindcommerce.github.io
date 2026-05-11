import { describe, expect, it } from 'vitest';
import { cleanMessageText, normalizeCompactText, normalizeSearchText } from '@/lib/textFormat';

describe('text formatting helpers', () => {
  it('turns messy email html into searchable text', () => {
    const html = '<div>Hello&nbsp;Tom<br><style>.x{}</style><script>x()</script><p>Order &amp; return</p></div>';

    expect(cleanMessageText(html)).toBe('Hello Tom\nOrder & return');
    expect(normalizeSearchText(html)).toContain('order return');
  });

  it('supports compact phone and id matching', () => {
    expect(normalizeCompactText('+44 (0) 7700-900123')).toBe('4407700900123');
  });
});
