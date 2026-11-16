/** Properties: one line per place, with what it has earned this year. */
import { router } from 'expo-router';
import { View } from 'react-native';

import { balances, statement } from '@/core/calc';
import { currentMonth, yearOf } from '@/core/dates';
import { useData } from '@/data/store';
import { useMoney } from '@/features/hooks';
import { kindLabel, useLocale, useT } from '@/i18n';
import { Button, Dot, Empty, Row, SectionTitle } from '@/ui/controls';
import { Block, Screen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, pigmentDot, space } from '@/ui/theme';

export default function PropertiesScreen() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const year = String(yearOf(currentMonth()));
  const active = data.properties.filter((p) => !p.archived);
  const archived = data.properties.filter((p) => p.archived);

  return (
    <Screen>
      <T variant="title" style={{ marginTop: space.md }}>
        {t('Mes biens', 'My properties')}
      </T>
      {active.length ? (
        <>
          <T color={color.inkSoft} style={{ marginTop: space.xs, marginBottom: space.lg }}>
            {t(`Ce que chacun me rapporte en ${year}.`, `What each one earns me in ${year}.`)}
          </T>
          <Block>
            {active.map((p, i) => {
              const s = statement(data, p.id, (m) => m.startsWith(year));
              const owed = balances(data, p.id).filter((b) => !b.party.is_me && Math.abs(b.balance) >= 1);
              const debt = owed.map((b) => (b.balance > 0 ? t(`je dois ${money(b.balance)} à ${b.party.name}`, `I owe ${b.party.name} ${money(b.balance)}`) : t(`${b.party.name} me doit ${money(-b.balance)}`, `${b.party.name} owes me ${money(-b.balance)}`)));
              return (
                <Row
                  key={p.id}
                  title={p.name}
                  subtitle={[kindLabel(p.kind, locale), ...debt].join(', ')}
                  value={money(s.mine, { sign: true })}
                  valueColor={s.mine < 0 ? color.negative : color.ink}
                  leading={<Dot tint={pigmentDot(p.color)} size={14} />}
                  onPress={() => router.push({ pathname: '/property/[id]', params: { id: p.id } })}
                  last={i === active.length - 1}
                />
              );
            })}
          </Block>
        </>
      ) : (
        <Empty title={t('Aucun bien pour l’instant', 'No property yet')} text={t('Ajoute ton premier logement ou importe ton classeur Excel.', 'Add your first place or import your Excel workbook.')} />
      )}

      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <Button label={t('Ajouter un bien', 'Add a property')} icon="plus" onPress={() => router.push('/property/new')} />
        <Button tone="quiet" label={t('Importer un classeur Excel', 'Import an Excel workbook')} icon="download" onPress={() => router.push('/import')} />
      </View>

      {archived.length ? (
        <>
          <SectionTitle>{t('Archivés', 'Archived')}</SectionTitle>
          <Block>
            {archived.map((p, i) => (
              <Row key={p.id} title={p.name} subtitle={kindLabel(p.kind, locale)} dimmed onPress={() => router.push({ pathname: '/property/[id]', params: { id: p.id } })} last={i === archived.length - 1} />
            ))}
          </Block>
        </>
      ) : null}
    </Screen>
  );
}
