/**
 * Public page of a shared statement. No sign-in: the token in the address is
 * the key, and the server returns only the snapshot published for it.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PublishedStatement } from '@/data/backend';
import { useStore } from '@/data/store';
import { StatementView } from '@/features/StatementView';
import { type Translate, deviceLocale } from '@/i18n';
import { Column } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, space } from '@/ui/theme';

export default function SharedStatementPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();
  const backend = useStore((s) => s.backend);
  const [state, setState] = useState<PublishedStatement | 'loading' | 'missing'>('loading');
  const locale = deviceLocale();
  const t: Translate = (fr, en) => (locale === 'fr' ? fr : en);

  useEffect(() => {
    backend
      .fetchShared(token)
      .then((found) => setState(found ?? 'missing'))
      .catch(() => setState('missing'));
  }, [backend, token]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.paper }} contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl }}>
      <Column>
        {state === 'loading' ? (
          <T color={color.inkSoft}>{t('Chargement du relevé…', 'Loading the statement…')}</T>
        ) : state === 'missing' ? (
          <View style={{ gap: space.sm, paddingTop: space.xxl }}>
            <T variant="title">{t('Ce relevé n’est plus disponible.', 'This statement is no longer available.')}</T>
            <T color={color.inkSoft}>{t('Le lien a été retiré ou il est incomplet. Demandez-en un nouveau à la personne qui vous l’a envoyé.', 'The link was withdrawn or is incomplete. Ask the person who sent it for a new one.')}</T>
          </View>
        ) : (
          <StatementView statement={state.statement} locale={locale} t={t} />
        )}
      </Column>
    </ScrollView>
  );
}
