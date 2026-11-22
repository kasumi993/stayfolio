/**
 * Opens a property through a member link. No account: the token in the
 * address is the key. What it gives access to is decided by the database.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useStore } from '@/data/store';
import { Mark } from '@/ui/Logo';
import { deviceLocale } from '@/i18n';
import { T } from '@/ui/Text';
import { color, space } from '@/ui/theme';

export default function MemberLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const status = useStore((s) => s.status);
  const revoked = useStore((s) => s.linkRevoked);
  const active = useStore((s) => s.backend.access?.token === token);
  const fr = deviceLocale() === 'fr';

  useEffect(() => {
    if (token) void useStore.getState().startMember(token);
  }, [token]);

  useEffect(() => {
    if (active && status === 'ready') router.replace('/');
  }, [active, status]);

  return (
    <View style={{ flex: 1, backgroundColor: color.paper, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg }}>
      <Mark size={56} />
      {revoked ? (
        <View style={{ gap: space.sm, maxWidth: 420 }}>
          <T variant="title" style={{ textAlign: 'center' }}>
            {fr ? 'Ce lien ne fonctionne plus.' : 'This link no longer works.'}
          </T>
          <T color={color.inkSoft} style={{ textAlign: 'center' }}>
            {fr
              ? 'Il a été renouvelé ou retiré. Demandez le nouveau lien à la personne qui vous l’a envoyé.'
              : 'It was renewed or withdrawn. Ask the person who sent it for the new link.'}
          </T>
        </View>
      ) : (
        <ActivityIndicator color={color.ink} />
      )}
    </View>
  );
}
