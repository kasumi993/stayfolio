/** Publish a read-only statement for an owner or a partner. */
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Share, View } from 'react-native';

import { ruleFor } from '@/core/calc';
import { addMonths, monthRange } from '@/core/dates';
import { buildSharedStatement } from '@/core/sharing';
import { useData, useStore } from '@/data/store';
import { usePartiesOf } from '@/features/hooks';
import { shareUrl } from '@/features/links';
import { Stepper } from '@/features/MonthStepper';
import { StatementView, periodLabel } from '@/features/StatementView';
import { monthLabel, useLocale, useT } from '@/i18n';
import { Button, Choice, Notice, Toggle } from '@/ui/controls';
import { Label } from '@/ui/fields';
import { FormScreen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, radius, space } from '@/ui/theme';

export default function ShareScreen() {
  const { property: propertyId } = useLocalSearchParams<{ property: string }>();
  const t = useT();
  const locale = useLocale();
  const data = useData();
  const month = useStore((s) => s.month);
  const publish = useStore((s) => s.publish);
  const others = usePartiesOf(propertyId).filter((p) => !p.is_me);
  const property = data.properties.find((p) => p.id === propertyId);

  const [partyId, setPartyId] = useState(others[0]?.id ?? '');
  const [from, setFrom] = useState(month);
  const [to, setTo] = useState(month);
  const [showCommission, setShowCommission] = useState(true);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasCommission = (ruleFor(data.rules, propertyId, to)?.commission_rate ?? 0) > 0;
  const statement = useMemo(() => {
    try {
      return buildSharedStatement(data, propertyId, partyId, monthRange(from, to), { showCommission });
    } catch {
      return null;
    }
  }, [data, propertyId, partyId, from, to, showCommission]);

  async function submit() {
    if (!statement || !property) return;
    setBusy(true);
    try {
      const share = await publish({ property_id: propertyId, party_id: partyId, title: `${property.name}, ${periodLabel(statement, locale)}` }, statement);
      setLink(shareUrl(share.token));
    } finally {
      setBusy(false);
    }
  }

  if (link) {
    return (
      <FormScreen title={t('Relevé publié', 'Statement published')}>
        <Notice tone="positive" icon="check" text={t('Toute personne qui a ce lien peut lire ce relevé, et seulement ce relevé. Tu peux le retirer à tout moment depuis la fiche du bien.', 'Anyone with this link can read this statement, and only this statement. You can withdraw it at any time from the property page.')} />
        <View style={{ borderWidth: 1, borderColor: color.line, borderRadius: radius.lg, padding: space.lg }}>
          <T variant="label" selectable>
            {link}
          </T>
        </View>
        <Button icon="share" label={t('Envoyer le lien', 'Send the link')} onPress={() => void Share.share({ message: link }).catch(() => {})} />
        <Button
          tone="quiet"
          icon="link"
          label={copied ? t('Lien copié', 'Link copied') : t('Copier le lien', 'Copy the link')}
          onPress={() => {
            void Clipboard.setStringAsync(link);
            setCopied(true);
          }}
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen title={t('Publier un relevé', 'Publish a statement')} footer={<Button icon="share" label={t('Publier et obtenir le lien', 'Publish and get the link')} onPress={submit} busy={busy} disabled={!statement} />}>
      {others.length > 1 ? (
        <View>
          <Label>{t('Pour', 'For')}</Label>
          <Choice value={partyId} onChange={setPartyId} options={others.map((p) => ({ value: p.id, label: p.name }))} />
        </View>
      ) : null}
      <View style={{ borderWidth: 1, borderColor: color.line, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
        <View>
          <Label>{t('Du mois de', 'From')}</Label>
          <Stepper label={monthLabel(from, locale)} onPrev={() => setFrom(addMonths(from, -1))} onNext={() => setFrom(addMonths(from, 1) > to ? to : addMonths(from, 1))} />
        </View>
        <View>
          <Label>{t('Au mois de', 'To')}</Label>
          <Stepper label={monthLabel(to, locale)} onPrev={() => setTo(addMonths(to, -1) < from ? from : addMonths(to, -1))} onNext={() => setTo(addMonths(to, 1))} />
        </View>
      </View>
      {hasCommission ? (
        <View style={{ borderWidth: 1, borderColor: color.line, borderRadius: radius.lg, padding: space.lg }}>
          <Toggle
            value={showCommission}
            onChange={setShowCommission}
            label={t('Afficher mes frais de gestion', 'Show my management fee')}
            hint={showCommission ? t('Une seule ligne « Frais de gestion », sans détail par réservation.', 'A single “Management fee” line, with no per-booking detail.') : t('Les revenus sont affichés nets de mes frais. Le montant de ma commission n’apparaît nulle part.', 'Income is shown net of my fee. The amount of my commission appears nowhere.')}
          />
        </View>
      ) : null}

      <T variant="heading">{t('Ce que la personne verra', 'What they will see')}</T>
      {statement ? <StatementView statement={statement} locale={locale} t={t} /> : null}
    </FormScreen>
  );
}
