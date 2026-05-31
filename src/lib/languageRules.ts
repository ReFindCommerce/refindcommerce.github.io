import { cleanMessageText } from './textFormat';

const ambiguousEnglishPattern = /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|can you help\??|i have (a )?few questions\.? can you help\??)$/i;
const nonEnglishCustomerSignalPattern = /\b(?:bonjour|bonsoir|salut|merci|s'il|vous|votre|avec|hola|gracias|buenos|buenas|por favor|precio|quanto|prezzo|ciao|grazie|hallo|guten|danke|bitte|preis|wie|kann|cijena|kako|puni|zanima|hvala)\b/i;
const nonEnglishReplySignalPattern = /\b(?:bonjour|bonsoir|merci|votre|vous|avec|hola|gracias|precio|ciao|grazie|hallo|guten|danke|bitte|preis|wie|kann|ihnen|heute|helfen|benotigen|benoetigen)\b/i;
const germanCustomerSignalPattern = /\b(?:deutsch|guten|ich|habe|mehrere|karte|karten|defekt|wurde|durchgef(?:u|ü)hrt|verbindung|nicht|m(?:ö|oe|o)glich|gerät|geraet|verbinden|koppeln)\b/i;

function countAsciiLetters(text: string): number {
  return text.match(/[A-Za-z]/g)?.length || 0;
}

function countNonAsciiLetters(text: string): number {
  return [...text].filter((char) => char.charCodeAt(0) > 127).length;
}

export function hasClearNonEnglishCustomerSignal(value: string | null | undefined): boolean {
  const text = cleanMessageText(value);
  if (!text) return false;

  const asciiLetters = countAsciiLetters(text);
  const nonAsciiLetters = countNonAsciiLetters(text);
  if (nonAsciiLetters >= 2 && nonAsciiLetters / Math.max(text.length, 1) > 0.015) return true;

  return (nonEnglishCustomerSignalPattern.test(text) || germanCustomerSignalPattern.test(text)) && asciiLetters > 2;
}

export function shouldDefaultCustomerLanguageToEnglish(value: string | null | undefined): boolean {
  const text = cleanMessageText(value);
  if (!text) return true;
  if (ambiguousEnglishPattern.test(text)) return true;
  return !hasClearNonEnglishCustomerSignal(text);
}

export function replyAppearsNonEnglish(value: string | null | undefined): boolean {
  const text = cleanMessageText(value);
  if (!text) return false;

  const nonAsciiLetters = countNonAsciiLetters(text);
  if (nonAsciiLetters >= 3 && nonAsciiLetters / Math.max(text.length, 1) > 0.02) return true;

  return nonEnglishReplySignalPattern.test(text);
}

export function shouldReplaceWithEnglishFallback(
  customerMessage: string | null | undefined,
  aiReply: string | null | undefined,
): boolean {
  return shouldDefaultCustomerLanguageToEnglish(customerMessage) && replyAppearsNonEnglish(aiReply);
}

export function buildEnglishFallbackReply(customerMessage: string | null | undefined): string {
  const text = cleanMessageText(customerMessage);

  if (!text || ambiguousEnglishPattern.test(text)) {
    return 'Hi! How can I help?';
  }

  return "Thanks for your message. I can help with this.";
}
