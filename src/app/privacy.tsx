/** Privacy policy. Public: the App Store and Google Play require its address. */
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Translate, deviceLocale } from '@/i18n';
import { Column } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, space } from '@/ui/theme';

export default function PrivacyPage() {
  const insets = useSafeAreaInsets();
  const locale = deviceLocale();
  const t: Translate = (fr, en) => (locale === 'fr' ? fr : en);
  const sections: [string, string][] = [
    [
      t('Ce que Stayfolio enregistre', 'What Stayfolio stores'),
      t(
        'Votre adresse e-mail (pour vous connecter) et ce que vous saisissez : biens, revenus, dépenses, règles de partage, versements, photos et PDF de justificatifs. Rien d’autre : pas de suivi publicitaire, pas d’outil d’analyse, pas de localisation.',
        'Your email address (to sign in) and what you enter: properties, income, expenses, sharing rules, payments, photos and PDFs of receipts. Nothing else: no advertising tracking, no analytics, no location.',
      ),
    ],
    [
      t('Où et comment', 'Where and how'),
      t(
        'Les données sont hébergées chez Supabase, dans l’Union européenne (Paris). Chaque compte ne peut lire que ses propres données ; cette règle est appliquée par la base de données elle-même. Les justificatifs sont dans un espace privé, accessibles uniquement par des liens temporaires.',
        'Data is hosted by Supabase in the European Union (Paris). Each account can only read its own data; the database itself enforces this rule. Receipts live in a private space, reachable only through temporary links.',
      ),
    ],
    [
      t('Relevés partagés', 'Shared statements'),
      t(
        'Quand vous publiez un relevé, une copie figée de ce relevé devient lisible par toute personne qui possède le lien. Vous pouvez retirer un lien à tout moment.',
        'When you publish a statement, a frozen copy of it becomes readable by anyone holding the link. You can withdraw a link at any time.',
      ),
    ],
    [
      t('Assistant (facultatif)', 'Assistant (optional)'),
      t(
        'Si vous utilisez la lecture de reçus ou les questions, la photo du reçu ou les totaux mensuels concernés sont envoyés à Anthropic pour produire la réponse. Ils ne sont pas envoyés autrement.',
        'If you use receipt reading or questions, the receipt photo or the relevant monthly totals are sent to Anthropic to produce the answer. They are not sent otherwise.',
      ),
    ],
    [
      t('Vos droits', 'Your rights'),
      t(
        'Vous pouvez exporter toutes vos données vers Excel et supprimer votre compte, avec toutes ses données, depuis Réglages. La suppression est immédiate et définitive.',
        'You can export all your data to Excel and delete your account, with all its data, from Settings. Deletion is immediate and final.',
      ),
    ],
  ];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.paper }} contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xxl }}>
      <Column>
        <T variant="title">{t('Confidentialité', 'Privacy')}</T>
        <T color={color.inkSoft} style={{ marginTop: space.xs }}>
          Stayfolio
        </T>
        {sections.map(([title, body]) => (
          <View key={title} style={{ marginTop: space.xl, gap: space.xs }}>
            <T variant="heading">{title}</T>
            <T>{body}</T>
          </View>
        ))}
      </Column>
    </ScrollView>
  );
}
