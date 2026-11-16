/** Properties: one card per place, with what it has earned this year. */
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { balances, occupancy, payback, statement } from '@/core/calc';
import { currentMonth, monthRange, yearOf } from '@/core/dates';
import type { Property } from '@/core/types';
import { useData } from '@/data/store';
import { useMoney } from '@/features/hooks';
import { PageHeader } from '@/features/PageHeader';
import { kindLabel, useLocale, useT } from '@/i18n';
import { Ring } from '@/ui/charts';
import { Button, Empty, Row, SectionTitle } from '@/ui/controls';
import { Block, Screen, useWide } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, pigmentDot, pigmentOf, radius, space } from '@/ui/theme';

export default function PropertiesScreen() {
  const t = useT();
  const locale = useLocale();
  const wide = useWide();
  const data = useData();
  const year = String(yearOf(currentMonth()));
  const active = data.properties.filter((p) => !p.archived);
  const archived = data.properties.filter((p) => p.archived);
  const open = (p: Property) => router.push({ pathname: '/property', params: { id: p.id } });

  return (
    <Screen>
      <PageHeader
        title={t('Mes biens', 'My properties')}
        subtitle={active.length ? t(`Ce que chacun me rapporte en ${year}.`, `What each one earns me in ${year}.`) : undefined}
        filter={false}
        action={wide ? <Button compact tone="quiet" icon="plus" label={t('Ajouter un bien', 'Add a property')} onPress={() => router.push('/property-form')} /> : undefined}
      />
      {active.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
          {active.map((p) => (
            <View key={p.id} style={{ width: wide ? '48.5%' : '100%' }}>
              <PropertyCard property={p} year={year} onPress={() => open(p)} />
            </View>
          ))}
        </View>
      ) : (
        <Empty title={t('Aucun bien pour l’instant', 'No property yet')} text={t('Ajoute ton premier logement ou importe ton classeur Excel.', 'Add your first place or import your Excel workbook.')} />
      )}

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.sm, marginTop: space.xl }}>
        {!wide ? <Button label={t('Ajouter un bien', 'Add a property')} icon="plus" onPress={() => router.push('/property-form')} /> : null}
        <Button tone="quiet" label={t('Importer un classeur Excel', 'Import an Excel workbook')} icon="download" onPress={() => router.push('/import')} />
      </View>

      {archived.length ? (
        <View style={{ maxWidth: 720 }}>
          <SectionTitle>{t('Archivés', 'Archived')}</SectionTitle>
          <Block>
            {archived.map((p, i) => (
              <Row key={p.id} title={p.name} subtitle={kindLabel(p.kind, locale)} dimmed onPress={() => open(p)} last={i === archived.length - 1} />
            ))}
          </Block>
        </View>
      ) : null}
    </Screen>
  );
}

function PropertyCard({ property: p, year, onPress }: { property: Property; year: string; onPress: () => void }) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const s = statement(data, p.id, (m) => m.startsWith(year));
  const occ = occupancy(data, p.id, monthRange(`${year}-01`, currentMonth()).filter((m) => m.startsWith(year)));
  const owed = balances(data, p.id).filter((b) => !b.party.is_me && Math.abs(b.balance) >= 1);
  const pb = p.kind === 'partnership' ? payback(data, p.id, currentMonth()) : null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={p.name} onPress={onPress} style={({ pressed }) => ({ borderWidth: 1, borderColor: color.line, borderRadius: radius.lg, overflow: 'hidden', opacity: pressed ? 0.7 : 1 })}>
      <View style={{ backgroundColor: pigmentOf(p.color), padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="heading" numberOfLines={1}>
            {p.name}
          </T>
          <T variant="small" color={color.inkSoft} numberOfLines={1}>
            {[kindLabel(p.kind, locale), p.location].filter(Boolean).join(', ')}
          </T>
        </View>
        <Ring value={occ.rate} size={46} stroke={6} tint={pigmentDot(p.color)}>
          <T variant="small" style={{ fontSize: 11 }}>
            {Math.round(occ.rate * 100)} %
          </T>
        </Ring>
      </View>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: 'row', gap: space.lg }}>
          <Figure label={t('Pour moi', 'For me')} value={money(s.mine, { sign: true })} tint={s.mine < 0 ? color.negative : color.positive} />
          <Figure label={t('Revenus', 'Income')} value={money(s.revenue)} />
          <Figure label={t('Dépenses', 'Expenses')} value={money(s.expenses)} />
        </View>
        {pb ? (
          <T variant="small" color={color.inkSoft}>
            {pb.cumulative < -1 ? t(`Encore ${money(-pb.cumulative)} à récupérer depuis le début.`, `${money(-pb.cumulative)} still to recover since the beginning.`) : t(`${money(pb.cumulative)} de bénéfice depuis le début.`, `${money(pb.cumulative)} of profit since the beginning.`)}
          </T>
        ) : null}
        {(pb ? [] : owed).map((b) => (
          <T key={b.party.id} variant="small" color={color.inkSoft}>
            {b.balance > 0 ? t(`Je dois ${money(b.balance)} à ${b.party.name}.`, `I owe ${b.party.name} ${money(b.balance)}.`) : t(`${b.party.name} me doit ${money(-b.balance)}.`, `${b.party.name} owes me ${money(-b.balance)}.`)}
          </T>
        ))}
      </View>
    </Pressable>
  );
}

const Figure = ({ label, value, tint = color.ink }: { label: string; value: string; tint?: string }) => (
  <View style={{ flex: 1, minWidth: 0 }}>
    <T variant="small" color={color.inkSoft} numberOfLines={1}>
      {label}
    </T>
    <T variant="figure" color={tint} tabular numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </T>
  </View>
);
