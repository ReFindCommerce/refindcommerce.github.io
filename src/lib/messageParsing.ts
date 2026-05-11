import type { Message } from '@/types/inbox';
import { cleanMessageText } from './textFormat';

export interface MediaAttachment {
  url: string;
  kind: 'image' | 'video' | 'file';
  source: 'customer' | 'agent' | 'message';
}

export interface ExtractedContact {
  email: string | null;
  phone: string | null;
}

const urlPattern = /https?:\/\/[^\s<>"')\]]+/gi;
const imageExtensionPattern = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i;
const videoExtensionPattern = /\.(?:m4v|mov|mp4|webm)(?:[?#].*)?$/i;
const dataImagePattern = /^data:image\//i;
const dataVideoPattern = /^data:video\//i;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phonePattern = /(?:\+?\d[\d\s().-]{7,}\d)/;

function addUrl(urls: Set<string>, value: string | null | undefined): void {
  if (!value) return;
  const trimmed = value.trim().replace(/[.,;:!?]+$/, '');
  if (trimmed) urls.add(trimmed);
}

function extractHtmlUrls(value: string | null | undefined): string[] {
  if (!value || typeof DOMParser === 'undefined') return [];

  const doc = new DOMParser().parseFromString(value, 'text/html');
  return [...doc.querySelectorAll('img, video, source, a')]
    .flatMap((node) => [
      node.getAttribute('src'),
      node.getAttribute('href'),
      node.getAttribute('data-src'),
    ])
    .filter((url): url is string => Boolean(url));
}

function inferMediaKind(url: string): MediaAttachment['kind'] {
  if (dataVideoPattern.test(url) || videoExtensionPattern.test(url)) return 'video';
  if (dataImagePattern.test(url) || imageExtensionPattern.test(url)) return 'image';
  return 'file';
}

export function extractMediaAttachments(message: Message): MediaAttachment[] {
  const urls = new Set<string>();
  const explicitCustomer = [message.customer_image_url, message.image_url, message.ebay_image].filter(Boolean) as string[];
  const explicitAgent = [message.agent_image_url].filter(Boolean) as string[];
  const messageBodies = [message.user_message, message.final_reply, message.ai_reply];

  explicitCustomer.forEach((url) => addUrl(urls, url));
  explicitAgent.forEach((url) => addUrl(urls, url));

  messageBodies.forEach((body) => {
    extractHtmlUrls(body).forEach((url) => addUrl(urls, url));
    body?.match(urlPattern)?.forEach((url) => addUrl(urls, url));
  });

  return [...urls].map((url) => ({
    url,
    kind: inferMediaKind(url),
    source: explicitAgent.includes(url)
      ? 'agent'
      : explicitCustomer.includes(url)
        ? 'customer'
        : 'message',
  }));
}

export function extractLinks(value: string | null | undefined): string[] {
  const urls = new Set<string>();
  extractHtmlUrls(value).forEach((url) => addUrl(urls, url));
  value?.match(urlPattern)?.forEach((url) => addUrl(urls, url));
  return [...urls];
}

export function extractContactInfo(value: string | null | undefined): ExtractedContact {
  const text = cleanMessageText(value);
  return {
    email: text.match(emailPattern)?.[0] || null,
    phone: text.match(phonePattern)?.[0]?.replace(/\s+/g, ' ').trim() || null,
  };
}

export function hasNonEnglishSignals(value: string | null | undefined): boolean {
  const text = cleanMessageText(value);
  if (!text) return false;

  const asciiLetters = text.match(/[A-Za-z]/g)?.length || 0;
  const nonAsciiLetters = [...text].filter((char) => char.charCodeAt(0) > 127).length;
  if (nonAsciiLetters >= 2 && nonAsciiLetters / Math.max(text.length, 1) > 0.015) return true;

  return /\b(?:cijena|kako|puni|zanima|bonjour|hola|gracias|danke|bitte|preis|quanto|quanto|ciao|merci)\b/i.test(text) &&
    asciiLetters > 10;
}

export function buildTranslateUrl(text: string, targetLanguage = 'en'): string {
  const params = new URLSearchParams({
    sl: 'auto',
    tl: targetLanguage,
    op: 'translate',
    text,
  });
  return `https://translate.google.com/?${params.toString()}`;
}
