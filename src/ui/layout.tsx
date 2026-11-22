/**
 * Page scaffolding, and the one place that knows about screen size.
 *
 * The app has two layouts chosen by window width (`useWide`):
 *   - narrow (phones): one column, bottom tab bar, forms slide up full screen;
 *   - wide (desktop browser, tablets): sidebar, several columns, forms open as
 *     centred dialogs.
 * Resizing a browser window, or using its device simulator, switches live.
 */
import { router } from 'expo-router';
import { Children, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from './controls';
import { T } from './Text';
import { color, fill, maxWidth, pageWidth, radius, space, wideFrom } from './theme';

/** True when the window is wide enough for the desktop layout. */
export function useWide(): boolean {
  return useWindowDimensions().width >= wideFrom;
}

/** Centres content and caps its width: used by forms and reading pages. */
export const Column = ({ children, pad = true }: { children: ReactNode; pad?: boolean }) => (
  <View style={{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: pad ? 20 : 0 }}>{children}</View>
);

/** A main screen. `reading` keeps long lists at a comfortable width on desktop. */
export function Screen({ children, reading }: { children: ReactNode; reading?: boolean }) {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.paper }}
      contentContainerStyle={{
        paddingTop: wide ? space.xxl : insets.top + space.md,
        paddingBottom: wide ? 72 : insets.bottom + 120,
        paddingHorizontal: wide ? 40 : 20,
      }}
      keyboardShouldPersistTaps="handled">
      <View style={{ width: '100%', maxWidth: wide ? (reading ? 760 : pageWidth) : maxWidth, alignSelf: 'center' }}>{children}</View>
    </ScrollView>
  );
}

/**
 * Lays children side by side on a wide screen (with the given width ratios)
 * and stacks them on a phone.
 */
export function Cols({ children, ratio, gap = space.xxl }: { children: ReactNode; ratio?: number[]; gap?: number }) {
  const wide = useWide();
  const items = Children.toArray(children);
  if (!wide) return <View>{items}</View>;
  return (
    <View style={{ flexDirection: 'row', gap, alignItems: 'flex-start' }}>
      {items.map((child, i) => (
        <View key={i} style={{ flex: ratio?.[i] ?? 1, minWidth: 0 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** A thin-bordered frame for a chart or a group of figures. */
export const Card = ({ children, tint }: { children: ReactNode; tint?: string }) => (
  <View style={{ ...(tint ? fill(tint) : { borderWidth: 1, borderColor: color.line }), borderRadius: radius.lg, padding: space.lg }}>{children}</View>
);

/** Groups rows of a list. Deliberately frameless: rows sit directly on the page. */
export const Block = ({ children }: { children: ReactNode }) => (
  <View style={{ overflow: 'hidden' }}>
    <View style={{ marginBottom: -1 }}>{children}</View>
  </View>
);

/**
 * A form or detail opened on top of the app: full screen on a phone, a
 * centred dialog on a wide screen.
 */
export function FormScreen({ title, children, footer, back }: { title: string; children: ReactNode; footer?: ReactNode; back?: boolean }) {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const body = (
    <>
      <View style={{ paddingTop: wide ? space.lg : Platform.OS === 'ios' ? space.md : insets.top + space.sm, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: color.line }}>
        <Column>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.sm, marginLeft: -8 }}>
            <IconButton icon={back ? 'left' : 'close'} label="Fermer" onPress={close} />
            <T variant="heading" style={{ flex: 1 }} numberOfLines={1}>
              {title}
            </T>
          </View>
        </Column>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: space.xl, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
        <Column>
          <View style={{ gap: space.xl }}>{children}</View>
        </Column>
      </ScrollView>
      {footer ? (
        <View style={{ paddingTop: space.md, paddingBottom: (wide ? 0 : insets.bottom) + space.md, borderTopWidth: 1, borderTopColor: color.line, backgroundColor: color.paper }}>
          <Column>
            <View style={{ gap: space.sm }}>{footer}</View>
          </Column>
        </View>
      ) : null}
    </>
  );

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: color.veil, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <Pressable accessibilityLabel="Fermer la fenêtre" onPress={close} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
        <View style={{ width: '100%', maxWidth: 600, height: '92%', maxHeight: 860, backgroundColor: color.paper, borderRadius: radius.xl, overflow: 'hidden' }}>{body}</View>
      </View>
    );
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: color.paper }}>
      {body}
    </KeyboardAvoidingView>
  );
}

/** A short choice: slides up from the bottom on a phone, centred on a wide screen. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const content = (
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
  );
  return (
    <Modal visible={open} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
      {wide ? (
        <View style={{ flex: 1, backgroundColor: color.veil, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
          <Pressable accessibilityLabel="Fermer" onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
          <View style={{ width: '100%', maxWidth: 480, maxHeight: '85%', backgroundColor: color.paper, borderRadius: radius.xl, paddingVertical: space.xl }}>{content}</View>
        </View>
      ) : (
        <>
          <Pressable accessibilityLabel="Fermer" onPress={onClose} style={{ flex: 1, backgroundColor: color.veil }} />
          <View style={{ backgroundColor: color.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, marginTop: -radius.xl, paddingTop: space.xl, paddingBottom: insets.bottom + space.lg, maxHeight: '85%' }}>{content}</View>
        </>
      )}
    </Modal>
  );
}
