import { Button } from '@/components';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import * as Linking from 'expo-linking';
import { DEFAULT_INVITE_TEXT, buildWhatsAppLink } from '../lib/invite-link';

type Props = {
  phone?: string;
  text?: string;
  label?: string;
};

/**
 * Opens WhatsApp (native app or web) with a pre-filled invite message.
 * No contacts picker in v0 — the user picks their own recipient inside WhatsApp.
 */
export function InviteButton({
  phone,
  text = DEFAULT_INVITE_TEXT,
  label = 'Invite a friend',
}: Props) {
  const toast = useToast();

  const onPress = async () => {
    const url = buildWhatsAppLink(text, phone);
    log.event('invite.opened', { has_phone: Boolean(phone) });
    try {
      await Linking.openURL(url);
    } catch (err) {
      log.error('invite open failed', err);
      toast.show({ message: 'Could not open WhatsApp.', variant: 'error' });
    }
  };

  return <Button label={label} variant="ghost" onPress={onPress} />;
}
