import { View } from 'react-native';

import { useT } from '@/i18n';
import { IconButton } from '@/ui/controls';
import { T } from '@/ui/Text';
import { color, radius } from '@/ui/theme';

/** ‹ Novembre 2026 › on a light background, for forms. */
export function Stepper({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: color.paper, borderRadius: radius.md, height: 50 }}>
      <IconButton icon="left" label={t('Précédent', 'Previous')} onPress={onPrev} />
      <T variant="bodyBold">{label}</T>
      <IconButton icon="right" label={t('Suivant', 'Next')} onPress={onNext} />
    </View>
  );
}
