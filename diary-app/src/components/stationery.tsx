import React from 'react';
import { ActivityIndicator, Image, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Text } from './text';
import { useIllustrations, useTheme } from '../theme/ThemeProvider';
import { IMAGES } from '../data/assets';
import { mixHex } from '../theme/palette';
import { haptic } from './ui';

/* ---------------- 固定纸张色板（明信片在深色模式下依然是一张真实的暖白信笺） ---------------- */

const POSTCARD = {
  paper: '#FCF9F2',
  ink: '#26211D',
  sub: '#655B50',
  muted: '#8C8173',
  border: '#E5DEC9',
  rule: '#EFE9DC',
  headerRule: '#EAE2D0',
  tagBg: '#F3EDE0',
  tagBorder: '#DFD6C3',
  slipBg: '#F7F3E8',
  slipBorder: '#E3DBC8',
  slipFlap: '#E8DFCA',
  vermilion: '#C8554A',
  postmark: 'rgba(180, 85, 70, 0.55)',
} as const;

/** 把时间戳格式化成邮戳里的 MM.DD */
export function fmtPostmarkDate(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}.${day}`;
}

/* ---------------- 胶带 + 邮票 + 邮戳 小构件 ---------------- */

function WashiTape({ color }: { color: string }) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: -6,
        left: 20,
        width: 46,
        height: 13,
        transform: [{ rotate: '-5deg' }],
        zIndex: 2,
      }}
    >
      <Svg width={46} height={13} viewBox="0 0 46 13">
        <Path
          d="M2.5 0.5 L43.5 0.5 L41.5 3.6 L44.5 6.5 L41.5 9.4 L43.5 12.5 L2.5 12.5 L4.5 9.4 L1.5 6.5 L4.5 3.6 Z"
          fill={color}
          fillOpacity={0.86}
          stroke="rgba(120, 108, 90, 0.22)"
          strokeWidth={0.6}
        />
        <Line x1={7} y1={6.5} x2={39} y2={6.5} stroke="rgba(255, 255, 255, 0.45)" strokeWidth={0.8} strokeDasharray="2.5 2.5" />
      </Svg>
    </View>
  );
}

function PostageStampWithCancel({ postmark }: { postmark?: string }) {
  const { ink } = useTheme();
  const pack = useIllustrations();
  const art = ink.on ? IMAGES.companionBird : pack.memorySticker;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 62, height: 42, alignItems: 'flex-end', justifyContent: 'center' }}
    >
      {/* 齿孔邮票（34×40） */}
      <View
        style={{
          width: 34,
          height: 40,
          backgroundColor: '#FAF5E9',
          borderWidth: 1,
          borderColor: '#D8CFC0',
          borderRadius: 2,
          padding: 2.5,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            flex: 1,
            width: '100%',
            borderWidth: 0.75,
            borderColor: '#CFC4B0',
            borderStyle: 'dashed',
            backgroundColor: '#F5EFE1',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image source={art} style={{ width: 23, height: 23 }} resizeMode="contain" />
        </View>
      </View>

      {/* 叠盖在邮票左下角的朱砂邮戳圆环 + 水波销票线 */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 4,
          width: 56,
          height: 36,
          transform: [{ rotate: '-12deg' }],
        }}
      >
        <Svg width={56} height={36} viewBox="0 0 56 36">
          <Circle cx={18} cy={18} r={15.5} stroke={POSTCARD.postmark} strokeWidth={1} fill="none" />
          <Circle cx={18} cy={18} r={12.8} stroke={POSTCARD.postmark} strokeWidth={0.65} strokeDasharray="2 1.5" fill="none" />
          <Path d="M33 12 Q38 9.8, 43 12 T53 12" stroke={POSTCARD.postmark} strokeWidth={0.85} fill="none" strokeLinecap="round" />
          <Path d="M34 18 Q39 15.8, 44 18 T54 18" stroke={POSTCARD.postmark} strokeWidth={0.85} fill="none" strokeLinecap="round" />
          <Path d="M33 24 Q38 21.8, 43 24 T53 24" stroke={POSTCARD.postmark} strokeWidth={0.85} fill="none" strokeLinecap="round" />
        </Svg>
        {!!postmark && (
          <View style={{ position: 'absolute', left: 2, top: 0, width: 32, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Text
              numberOfLines={2}
              style={{
                fontSize: postmark.includes('\n') ? 6.4 : 7.5,
                lineHeight: postmark.includes('\n') ? 7.8 : 10,
                fontWeight: '700',
                color: 'rgba(170, 74, 60, 0.72)',
                letterSpacing: 0.2,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
              }}
            >
              {postmark}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ---------------- A. 明信片来信 / 回看（PostcardNote） ---------------- */

export interface PostcardNoteProps {
  salutation: string;
  meta?: string;
  postmark?: string;
  body?: string;
  loadingText?: string;
  errorText?: string;
  actionLabel?: string;
  actionBusy?: boolean;
  actionDisabled?: boolean;
  onAction?: () => void;
  signature?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * 寄自「记得」的实体明信片：
 * 暖白棉纸 #FCF9F2、左上斜贴和纸胶带、右上邮票与销票邮戳、信纸横线与阅读衬线正文。
 */
export function PostcardNote({
  salutation,
  meta,
  postmark,
  body,
  loadingText,
  errorText,
  actionLabel,
  actionBusy,
  actionDisabled,
  onAction,
  signature = '—— 记得',
  children,
  style,
}: PostcardNoteProps) {
  const { c, t, fs, r, dark, ink, frameInk } = useTheme();
  const bodySize = fs(14.5);
  const bodyLineH = Math.round(bodySize * 1.82);
  const tapeColor = dark ? mixHex(c.primary, '#E8DFCE', 0.45) : c.primarySoft;

  const cardFrame: ViewStyle = dark
    ? {
        borderWidth: ink.on ? 1.5 : 1,
        borderColor: ink.on ? '#3B352D' : '#D5CCB8',
        boxShadow: '0px 4px 0px #000000',
      }
    : ink.on
      ? frameInk
      : {
          borderWidth: 1,
          borderColor: POSTCARD.border,
          shadowColor: '#2A2015',
          shadowOpacity: 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        };

  // 信纸浅横线（严格对齐 bodyLineH 基线）
  const ruleLines = React.useMemo(() => Array.from({ length: 14 }, (_, i) => (i + 1) * bodyLineH - 1), [bodyLineH]);

  return (
    <View style={[{ paddingTop: 6 }, style]}>
      <WashiTape color={tapeColor} />
      <View
        style={[
          {
            backgroundColor: POSTCARD.paper,
            borderRadius: r(12),
            paddingHorizontal: 18,
            paddingTop: 15,
            paddingBottom: 14,
          },
          cardFrame,
        ]}
      >
        {/* 信头：称呼 + 右上邮票邮戳 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontFamily: t.bodySerif.fontFamily,
                fontSize: fs(13.5),
                lineHeight: fs(20),
                color: '#463C32',
                fontWeight: '600',
                letterSpacing: 0.6,
              }}
            >
              {salutation}
            </Text>
            {!!meta && (
              <Text style={{ fontSize: fs(11), lineHeight: fs(16), color: POSTCARD.muted, marginTop: 2 }}>
                {meta}
              </Text>
            )}
          </View>
          <PostageStampWithCancel postmark={postmark} />
        </View>

        <View style={{ height: 1, backgroundColor: POSTCARD.headerRule, marginTop: 10, marginBottom: 12 }} />

        {/* 正文区：带微弱信纸横格线 */}
        {body ? (
          <View style={{ position: 'relative', overflow: 'hidden' }}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {ruleLines.map(top => (
                <View key={top} style={{ position: 'absolute', left: 0, right: 0, top, height: 1, backgroundColor: POSTCARD.rule }} />
              ))}
            </View>
            <Text
              textRole="reading"
              style={{
                fontFamily: t.bodySerif.fontFamily,
                fontSize: bodySize,
                lineHeight: bodyLineH,
                color: POSTCARD.ink,
              }}
            >
              {body}
            </Text>
          </View>
        ) : loadingText ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
            <ActivityIndicator size="small" color={POSTCARD.sub} />
            <Text
              textRole="reading"
              style={{
                fontFamily: t.bodySerif.fontFamily,
                fontSize: fs(13.5),
                lineHeight: fs(22),
                color: POSTCARD.sub,
              }}
            >
              {loadingText}
            </Text>
          </View>
        ) : errorText ? (
          <Text style={{ fontSize: fs(13), lineHeight: fs(20), color: '#B4473A', paddingVertical: 4 }}>
            {errorText}
          </Text>
        ) : null}

        {children}

        {/* 落款与重寄操作 */}
        {(!!signature || (onAction && actionLabel)) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, minHeight: 32 }}>
            {onAction && actionLabel ? (
              <Pressable
                accessibilityRole="button"
                disabled={actionDisabled || actionBusy}
                hitSlop={8}
                onPress={() => {
                  haptic('light');
                  onAction();
                }}
                style={({ pressed }) => ({
                  minHeight: 44,
                  minWidth: 44,
                  marginVertical: -6,
                  justifyContent: 'center',
                  paddingRight: 10,
                  opacity: actionDisabled || actionBusy ? 0.45 : pressed ? 0.65 : 1,
                })}
              >
                <Text style={{ fontSize: fs(12), color: POSTCARD.muted }}>
                  {actionBusy ? '正在写信…' : actionLabel}
                </Text>
              </Pressable>
            ) : (
              <View />
            )}
            {!!signature && (
              <Text
                textRole="reading"
                style={{
                  fontFamily: t.bodySerif.fontFamily,
                  fontSize: fs(13),
                  color: POSTCARD.sub,
                  letterSpacing: 0.8,
                }}
              >
                {signature}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/** 尚未回信时的安静小邮票签：不喧宾夺主，放在字数行右侧 */
export function PostcardTriggerStamp({
  label = '寄给记得，等一封回信 ›',
  onPress,
}: {
  label?: string;
  onPress: () => void;
}) {
  const { fs, dark } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label.replace(/\s*›$/, '')}
      hitSlop={6}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: dark ? '#1B2226' : POSTCARD.paper,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: dark ? '#344047' : '#DED6C6',
          borderRadius: 4,
          paddingHorizontal: 10,
          paddingVertical: 5,
        }}
      >
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: POSTCARD.vermilion, opacity: 0.8 }} />
        <Text
          style={{
            fontSize: fs(11.5),
            lineHeight: fs(16),
            color: dark ? '#CFC7B8' : '#4E4439',
            letterSpacing: 0.2,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
