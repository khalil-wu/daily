/** UI text defaults to system sans. Diary content opts into the preserved reading preference. */
import React, { createContext, useContext } from 'react';
import {
  Platform,
  type StyleProp,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps as NativeTextInputProps,
  type TextProps as NativeTextProps,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { resolveTextFont, type TextRole } from '../theme/typography';

export type TextProps = NativeTextProps & { textRole?: TextRole; tabIndex?: number };
export type TextInputProps = NativeTextInputProps & { textRole?: TextRole };
const TextRoleContext = createContext<TextRole>('ui');
const ANDROID_TEXT_STYLE: TextStyle | null = Platform.OS === 'android' ? { includeFontPadding: false } : null;

function readTextStyle(style: StyleProp<TextStyle>): TextStyle | undefined {
  if (!style) return undefined;
  if (Array.isArray(style) || typeof style === 'number') return StyleSheet.flatten(style) ?? undefined;
  return style as TextStyle;
}

type RNTextRef = React.ComponentRef<typeof RNText>;
export const Text = React.forwardRef<RNTextRef, TextProps>(function Text({ style, textRole, tabIndex, children, ...rest }, ref) {
  const { fonts } = useTheme();
  const parentRole = useContext(TextRoleContext);
  const flat = readTextStyle(style);
  const explicitReading = flat?.fontFamily === fonts.reading || (!!fonts.readingBold && flat?.fontFamily === fonts.readingBold);
  const role = textRole ?? (explicitReading ? 'reading' : flat?.fontFamily ? 'ui' : parentRole);
  const fontStyle = resolveTextFont(fonts, role, flat?.fontFamily, flat?.fontWeight);
  const node = (
    <RNText
      ref={ref}
      {...rest}
      {...(Platform.OS === 'web' && tabIndex !== undefined ? { tabIndex } : {})}
      style={[style, fontStyle, ANDROID_TEXT_STYLE]}
    >
      {children}
    </RNText>
  );
  return role !== parentRole ? <TextRoleContext.Provider value={role}>{node}</TextRoleContext.Provider> : node;
});

type RNTextInputRef = React.ComponentRef<typeof RNTextInput>;
export const TextInput = React.forwardRef<RNTextInputRef, TextInputProps>(function TextInput({ style, textRole = 'ui', ...rest }, ref) {
  const { fonts } = useTheme();
  const flat = readTextStyle(style);
  return <RNTextInput ref={ref} {...rest} style={[style, resolveTextFont(fonts, textRole, flat?.fontFamily, flat?.fontWeight), ANDROID_TEXT_STYLE]} />;
});

export const ReadingText = React.forwardRef<RNTextRef, NativeTextProps>(function ReadingText(props, ref) {
  return <Text ref={ref} {...props} textRole="reading" />;
});
export const ReadingTextInput = React.forwardRef<RNTextInputRef, NativeTextInputProps>(function ReadingTextInput(props, ref) {
  return <TextInput ref={ref} {...props} textRole="reading" />;
});
