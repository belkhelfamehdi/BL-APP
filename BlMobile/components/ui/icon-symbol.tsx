// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING | 'bolt';

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'checkmark': 'check',
  'checkmark.circle.fill': 'check-circle',
  'checkmark.circle': 'check-circle-outline',
  'xmark': 'close',
  'xmark.circle.fill': 'cancel',
  'arrow.clockwise': 'refresh',
  'arrow.left': 'arrow-back',
  'doc.text': 'description',
  'clipboard': 'content-paste',
  'trash': 'delete',
  'plus': 'add',
  'bolt.fill': 'bolt',
  'magnifyingglass': 'search',
  'tag.fill': 'local-offer',
  'ticket.fill': 'confirmation-number',
  'person.fill': 'person',
  'person.2.fill': 'group',
  'calendar': 'calendar-today',
  'exclamationmark.triangle.fill': 'warning',
  'info.circle.fill': 'info',
  'printer.fill': 'print',
  'square.and.arrow.up': 'share',
  'barcode.viewfinder': 'qr-code-scanner',
  'camera.fill': 'camera-alt',
  'list.bullet': 'list',
  'ellipsis': 'more-horiz',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
