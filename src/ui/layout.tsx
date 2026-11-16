/** Page scaffolding: scrolling screens, form screens and bottom sheets. */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from './controls';
import { T } from './Text';
import { color, maxWidth, radius, space } from './theme';

/** Centers content and caps its width, so the app also looks right in a browser. */
export const Column = ({ children, pad = true }: { children: ReactNode; pad?: boolean }) => (
  <View style={{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: pad ? space.lg : 0 }}>{children}</View>
);

/** A tab screen: optional full-bleed header, then scrolling content. */
export function Screen({ header, children }: { header?: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.paper }} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
      {header ?? <View style={{ height: insets.top + space.md }} />}
      <Column>{children}</Column>
    </ScrollView>
  );
}

/** A screen opened on top of the tabs: title bar with a close button, then a form. */
export function FormScreen({ title, children, footer, back }: { title: string; children: ReactNode; footer?: ReactNode; back?: boolean }) {
  const insets = useSafeAreaInsets();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: color.paper }}>
      <View style={{ paddingTop: Platform.OS === 'ios' ? space.md : insets.top + space.sm }}>
        <Column>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: space.sm }}>
            <IconButton icon={back ? 'left' : 'close'} label="Fermer" onPress={close} bg={color.surface} />
            <T variant="heading" style={{ flex: 1 }} numberOfLines={1}>
              {title}
            </T>
          </View>
        </Column>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
        <Column>
          <View style={{ gap: space.lg }}>{children}</View>
        </Column>
      </ScrollView>
      {footer ? (
        <View style={{ paddingTop: space.md, paddingBottom: insets.bottom + space.md, borderTopWidth: 1, borderTopColor: color.line, backgroundColor: color.paper }}>
          <Column>
            <View style={{ gap: space.sm }}>{footer}</View>
          </Column>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** A panel sliding up from the bottom, for short choices. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fermer" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(23,20,58,0.45)' }} />
      <View style={{ backgroundColor: color.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, marginTop: -radius.xl, paddingTop: space.lg, paddingBottom: insets.bottom + space.lg, maxHeight: '85%' }}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Column>
            {title ? (
              <T variant="heading" style={{ marginBottom: space.md }}>
                {title}
              </T>
            ) : null}
            {children}
          </Column>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** White rounded block that groups rows. The divider under the last row is clipped. */
export const Block = ({ children, pad = space.lg }: { children: ReactNode; pad?: number }) => (
  <View style={{ backgroundColor: color.surface, borderRadius: radius.lg, paddingHorizontal: pad, paddingVertical: pad / 2 }}>
    <View style={{ overflow: 'hidden' }}>
      <View style={{ marginBottom: -1 }}>{children}</View>
    </View>
  </View>
);
