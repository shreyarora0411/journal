import { Platform } from 'react-native';

/**
 * Build a WhatsApp deep link. Uses the universal wa.me URL which works
 * cross-platform (native app on phone, web on browser).
 *
 * If a phone number is provided it should be E.164 without the leading '+'.
 */
export const buildWhatsAppLink = (text: string, phone?: string): string => {
  const encoded = encodeURIComponent(text);
  const cleaned = (phone ?? '').replace(/\D/g, '');
  if (cleaned) return `https://wa.me/${cleaned}?text=${encoded}`;
  // No phone — opens chooser on phone, default chat on web.
  return Platform.OS === 'web'
    ? `https://wa.me/?text=${encoded}`
    : `whatsapp://send?text=${encoded}`;
};

export const DEFAULT_INVITE_TEXT = `I've been logging my trips on lore — quietly useful, only your friends can see. Want in?\n\nhttps://journal.app/invite`;
