/**
 * Says whose eyes the app is seen through when it is not the owner's: a
 * member who opened a shared link, or the owner previewing a member's view.
 */
import { View } from 'react-native';

import { useStore } from '@/data/store';
import { useT } from '@/i18n';
import { Button, TextLink } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { T } from '@/ui/Text';
import { color, radius, space } from '@/ui/theme';

import { useAccess } from './hooks';

export function MemberBar({ compact }: { compact?: boolean }) {
  const t = useT();
  const { access } = useAccess();
  const leave = useStore((s) => s.leaveMember);
  if (!access) return null;

  if (access.preview && !compact) {
    // On a phone: one slim line above the tab bar, so it hides little of the page.
    return (
      <View style={{ backgroundColor: color.ink, borderRadius: radius.lg, paddingVertical: 8, paddingLeft: 14, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name="eye" size={16} color={color.paper} />
        <T variant="label" color={color.paper} style={{ flex: 1 }} numberOfLines={1}>
          {t(`Ce que voit ${access.name}`, `What ${access.name} sees`)}
        </T>
        <Button compact tone="quiet" style={{ backgroundColor: color.paper }} label={t('Revenir', 'Back')} onPress={() => void leave()} />
      </View>
    );
  }

  if (access.preview) {
    return (
      <View style={{ backgroundColor: color.ink, borderRadius: radius.lg, padding: compact ? space.md : 14, gap: space.sm }}>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Icon name="eye" size={18} color={color.paper} />
          <T variant="bodyBold" color={color.paper} style={{ flex: 1 }}>
            {t(`Ce que voit ${access.name}`, `What ${access.name} sees`)}
          </T>
        </View>
        <T variant="small" color={color.paper} style={{ opacity: 0.75 }}>
          {access.canEdit
            ? t('Aperçu en lecture. Avec son lien, cette personne peut aussi ajouter et modifier.', 'Read-only preview. With their link, this person can also add and edit.')
            : t('Aperçu en lecture seule, comme pour cette personne.', 'Read-only, as it is for this person.')}
        </T>
        <Button compact tone="quiet" style={{ backgroundColor: color.paper }} label={t('Revenir à mon compte', 'Back to my account')} onPress={() => void leave()} />
      </View>
    );
  }

  // A member on a phone sees who shared the property in the page header.
  if (!compact) return null;
  return (
    <View style={{ gap: 6, paddingHorizontal: 6 }}>
      <T variant="small" color={color.inkSoft}>
        {access.ownerName ? t(`Partagé par ${access.ownerName}`, `Shared by ${access.ownerName}`) : t('Bien partagé avec vous', 'Shared with you')}
      </T>
      {access.canEdit ? null : (
        <T variant="small" color={color.inkFaint}>
          {t('Lecture seule', 'Read only')}
        </T>
      )}
      <TextLink label={t('Fermer ce partage sur cet appareil', 'Close this share on this device')} onPress={() => void leave()} />
    </View>
  );
}
