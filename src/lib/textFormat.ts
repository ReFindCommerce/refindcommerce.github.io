const whitespacePattern = /\s+/g;
const htmlEntityPattern = /&(?:[a-z]+|#\d+|#x[\da-f]+);/i;
const htmlTagPattern = /<\/?[a-z][\s\S]*>/i;

function decodeEntities(value: string): string {
  if (!htmlEntityPattern.test(value)) return value;

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtml(value: string): string {
  if (!htmlTagPattern.test(value)) return value;

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(value, 'text/html');
    doc.querySelectorAll('script, style, noscript').forEach((node) => node.remove());
    doc.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
    doc.querySelectorAll('p, div, li, tr, h1, h2, h3, h4').forEach((node) => {
      node.append('\n');
    });
    return doc.body.textContent || '';
  }

  return value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-4])>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

export function cleanMessageText(value: string | null | undefined): string {
  if (!value) return '';

  return decodeEntities(stripHtml(value))
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(whitespacePattern, ' ')
    .trim();
}

export function normalizeSearchText(value: string | null | undefined): string {
  return cleanMessageText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}@.+-]+/gu, ' ')
    .replace(whitespacePattern, ' ')
    .trim();
}

export function normalizeCompactText(value: string | null | undefined): string {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, '');
}
