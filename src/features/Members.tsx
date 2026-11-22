/**
 * People a property is shared with through a personal link (no account, no
 * password), as listed on the property page.
 */
import { router } from 'expo-router';
import { View } from 'react-native';

import type { Member, MemberPage, Property } from '@/core/types';
import { useStore } from '@/data/store';
import { type Translate, dayLabel, useLocale, useT } from '@/i18n';
import { Row, SectionTitle, TextLink } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Block } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, space } from '@/ui/theme';

import { webOrigin } from './links';

export const memberUrl = (token: string): string => `${webOrigin()}/m/${token}`;

export function pageLabel(page: MemberPage, t: Translate): string {
  return {
    income: t('Revenus', 'Income'),
    expenses: t('Dépenses', 'Expenses'),
    invoices: t('Factures', 'Invoices'),
    report: t('Résultat et bilan', 'Result and report'),
    cash: t('Caisse et apports', 'Cash and contributions'),
  }[page];
}

export function MembersSection({ property }: { property: Property }) {
  const t = useT();
  const locale = useLocale();
  const members = useStore((s) => s.data.members).filter((m) => m.property_id === property.id);
  const invite = () => router.push({ pathname: '/member', params: { property: property.id } });

  return (
    <View>
      <SectionTitle action={<TextLink label={t('Inviter', 'Invite')} onPress={invite} />}>{t('Membres', 'Members')}</SectionTitle>
      {members.length ? (
        <Block>
          {members.map((m, i) => (
            <Row
              key={m.id}
              leading={<Icon name={m.can_edit ? 'edit' : 'eye'} size={17} color={color.inkSoft} />}
              title={m.name}
              subtitle={summary(m, t, locale)}
              note={m.can_edit ? t('modifie', 'edits') : t('consulte', 'views')}
              onPress={() => router.push({ pathname: '/member', params: { id: m.id } })}
              last={i === members.length - 1}
            />
          ))}
        </Block>
      ) : (
        <T color={color.inkSoft} style={{ marginBottom: space.sm }}>
          {t(
            'Partage ce bien avec quelqu’un grâce à un lien, sans compte ni mot de passe. Tu choisis ce que la personne voit, si elle peut modifier, et tu peux couper l’accès quand tu veux.',
            'Share this place with someone through a link, no account or password. You choose what they see, whether they can edit, and you can cut access any time.',
          )}
        </T>
      )}
    </View>
  );
}

function summary(m: Member, t: Translate, locale: 'fr' | 'en'): string {
  const pages = m.pages.map((p) => pageLabel(p, t).toLowerCase()).join(', ');
  const seen = m.last_seen_at ? t(`ouvert le ${dayLabel(m.last_seen_at.slice(0, 10), locale)}`, `opened ${dayLabel(m.last_seen_at.slice(0, 10), locale)}`) : t('pas encore ouvert', 'not opened yet');
  return `${pages.charAt(0).toUpperCase()}${pages.slice(1)}. ${seen.charAt(0).toUpperCase()}${seen.slice(1)}${m.monthly_report ? t(', reçoit le rapport', ', gets the report') : ''}`;
}
