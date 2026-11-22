import React from 'react';
import { ActivityIndicator, Image, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Rect } from 'react-native-svg';
import { Text } from './text';
import { useIllustrations, useTheme } from '../theme/ThemeProvider';
import { IMAGES } from '../data/assets';
import { luminance, mixHex } from '../theme/palette';
import { SERIF, SERIF_BOLD } from '../theme/tokens';
import { InkPress, haptic } from './ui';
import { PressableScale } from './motion';

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

/** 把时段格式化成双行邮戳（起止 MM.DD） */
export function fmtPostmarkRange(fromTs: number, toInclusiveTs: number): string {
  return `${fmtPostmarkDate(fromTs)}\n${fmtPostmarkDate(toInclusiveTs)}`;
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

/** 明信片上的墨印主题小签（替代圆胶囊 SaaS 标签） */
export function InkStampTag({ label }: { label: string }) {
  const { fs } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 3,
        backgroundColor: POSTCARD.tagBg,
        borderWidth: 1,
        borderColor: POSTCARD.tagBorder,
      }}
    >
      <Text style={{ fontSize: fs(11.5), lineHeight: fs(16), color: '#52473B', letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}

/* ---------------- B. 折角书摘纸条（QuoteSlip） ---------------- */

export interface QuoteSlipProps {
  text: string;
  attribution?: string;
  onPress?: () => void;
  /** 折角背后露出的底纸色（在明信片内默认为 #FCF9F2） */
  cutoutBg?: string;
  style?: StyleProp<ViewStyle>;
}

/** 夹在信笺里的折角书摘纸条：右上 10px 折角三角形 + 阅读斜体引文 */
export function QuoteSlip({
  text,
  attribution = '—— 摘自那天的日记 ›',
  onPress,
  cutoutBg = POSTCARD.paper,
  style,
}: QuoteSlipProps) {
  const { t, fs } = useTheme();
  const content = (
    <View
      style={[
        {
          position: 'relative',
          backgroundColor: POSTCARD.slipBg,
          borderRadius: 5,
          borderTopRightRadius: 0,
          borderWidth: 1,
          borderColor: POSTCARD.slipBorder,
          paddingHorizontal: 13,
          paddingTop: 11,
          paddingBottom: 10,
        },
        style,
      ]}
    >
      {/* 右上 10px 折角（遮掉原直角边框 + 翻折纸背三角） */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', top: -1, right: -1, width: 12, height: 12 }}
      >
        <Svg width={12} height={12} viewBox="0 0 12 12">
          <Polygon points="0,0 12,0 12,12" fill={cutoutBg} />
          <Polygon points="0,0 0,11 11,11" fill={POSTCARD.slipFlap} stroke="#CFC5AE" strokeWidth={0.8} strokeLinejoin="round" />
        </Svg>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingRight: 6 }}>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={{
            fontFamily: SERIF,
            fontSize: fs(22),
            lineHeight: fs(22),
            color: '#9C8E79',
            width: 16,
            marginRight: 3,
            marginTop: -1,
          }}
        >
          “
        </Text>
        <Text
          textRole="reading"
          style={{
            flex: 1,
            fontFamily: t.bodySerif.fontFamily,
            fontSize: fs(13),
            lineHeight: Math.round(fs(13) * 1.68),
            color: '#3B342D',
            fontStyle: 'italic',
          }}
        >
          {text}
        </Text>
      </View>

      {!!attribution && (
        <Text
          style={{
            fontSize: fs(11.5),
            lineHeight: fs(16),
            color: '#786856',
            textAlign: 'right',
            marginTop: 6,
          }}
        >
          {attribution}
        </Text>
      )}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => ({ minHeight: 44, opacity: pressed ? 0.8 : 1 })}
    >
      {content}
    </Pressable>
  );
}

/* ---------------- 安静空白便签（NoteSlip：周记尚未生成时） ---------------- */

export function NoteSlip({
  title,
  body,
  actionLabel,
  busy,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  busy?: boolean;
  onAction?: () => void;
}) {
  const { t, fs, r, dark, ink } = useTheme();
  const paperBg = dark ? '#1B2226' : POSTCARD.paper;
  const inkMain = dark ? '#EAE4D7' : POSTCARD.ink;
  const inkSub = dark ? '#A59E92' : POSTCARD.sub;
  const borderCol = dark ? '#2D383E' : POSTCARD.border;

  return (
    <View
      style={{
        backgroundColor: paperBg,
        borderRadius: r(12),
        borderWidth: ink.on ? 1.25 : 1,
        borderColor: ink.on && !dark ? ink.line : borderCol,
        paddingHorizontal: 18,
        paddingVertical: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          style={{
            fontFamily: t.bodySerif.fontFamily,
            fontSize: fs(14.5),
            lineHeight: fs(21),
            fontWeight: '600',
            color: inkMain,
            letterSpacing: 0.4,
          }}
        >
          {title}
        </Text>
        <Text accessibilityElementsHidden aria-hidden style={{ fontSize: 10, color: inkSub, opacity: 0.55 }}>
          ◇
        </Text>
      </View>

      <Text style={{ fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.68), color: inkSub, marginTop: 8 }}>
        {body}
      </Text>

      {onAction && actionLabel && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            haptic('light');
            onAction();
          }}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            minHeight: 44,
            justifyContent: 'center',
            marginTop: 6,
            marginBottom: -6,
            opacity: busy ? 0.6 : pressed ? 0.7 : 1,
          })}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: 4,
              backgroundColor: dark ? 'rgba(234,228,215,0.08)' : '#F3EDE0',
              borderWidth: 1,
              borderColor: dark ? 'rgba(234,228,215,0.18)' : '#DFD6C3',
            }}
          >
            {busy ? (
              <ActivityIndicator size={12} color={inkMain} />
            ) : (
              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: POSTCARD.vermilion }} />
            )}
            <Text style={{ fontSize: fs(12), color: inkMain, fontWeight: '500', letterSpacing: 0.2 }}>
              {actionLabel}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

/* ---------------- C. 布面烫金年鉴书脊卡（YearbookSpineCard） ---------------- */

export function YearbookSpineCard({
  year,
  bookName,
  subtitle = '情绪像素 · 年度词云 · 高光时刻',
  badge = '翻阅',
  onPress,
}: {
  year: number;
  bookName?: string;
  subtitle?: string;
  badge?: string;
  onPress: () => void;
}) {
  const { c, fs, r, dark, ink, fonts } = useTheme();
  const rawBg = ink.on
    ? dark ? '#182428' : '#223136'
    : mixHex(c.primaryDark, '#1A1D1F', 0.55);
  // 确保任何浅色/墨白强调色在深色模式下也能衬出暖白烫金字
  const plateBg = luminance(rawBg) > 0.16 ? mixHex(rawBg, '#15191C', 0.5) : rawBg;
  const cream = '#F7F3EA';
  const creamSub = 'rgba(247, 243, 234, 0.7)';
  const foil = '#D8C39A';

  const faceStyle: ViewStyle = {
    backgroundColor: plateBg,
    borderTopLeftRadius: r(6),
    borderBottomLeftRadius: r(6),
    borderTopRightRadius: r(14),
    borderBottomRightRadius: r(14),
    borderWidth: ink.on ? 1.5 : 1,
    borderColor: ink.on ? (dark ? '#384D55' : ink.line) : 'rgba(247, 243, 234, 0.16)',
    overflow: 'hidden',
  };

  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 68, paddingRight: 14 }}>
      {/* 左侧书脊双道烫金细线 */}
      <View
        pointerEvents="none"
        style={{
          alignSelf: 'stretch',
          flexDirection: 'row',
          paddingLeft: 9,
          marginRight: 12,
        }}
      >
        <View style={{ width: 2, backgroundColor: foil, opacity: 0.72 }} />
        <View style={{ width: 2.5 }} />
        <View style={{ width: 0.8, backgroundColor: foil, opacity: 0.42 }} />
      </View>

      {/* 年份印记 */}
      <View style={{ paddingVertical: 13, paddingRight: 12, alignItems: 'center' }}>
        <Text style={{ fontSize: 8.5, letterSpacing: 1.4, color: foil, opacity: 0.88, fontWeight: '600' }}>
          ALMANAC
        </Text>
        <Text
          style={{
            fontFamily: SERIF_BOLD,
            fontSize: fs(24),
            lineHeight: fs(28),
            letterSpacing: 1,
            color: cream,
            fontVariant: ['tabular-nums'],
            marginTop: 1,
          }}
        >
          {year}
        </Text>
      </View>

      <View style={{ width: StyleSheet.hairlineWidth, height: 32, backgroundColor: 'rgba(247, 243, 234, 0.18)', marginRight: 12 }} />

      {/* 标题与副标题 */}
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 13 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.reading,
            fontSize: fs(15),
            lineHeight: fs(21),
            fontWeight: '600',
            color: cream,
            letterSpacing: 0.4,
          }}
        >
          {bookName ? `${bookName} · ` : ''}时光年鉴
        </Text>
        <Text numberOfLines={1} style={{ fontSize: fs(11.5), lineHeight: fs(16), color: creamSub, marginTop: 3 }}>
          {subtitle}
        </Text>
      </View>

      {/* 朱砂方印徽章 */}
      <View
        style={{
          marginLeft: 10,
          backgroundColor: POSTCARD.vermilion,
          borderRadius: r(6),
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderWidth: 1,
          borderColor: 'rgba(255, 246, 236, 0.34)',
        }}
      >
        <Text
          style={{
            fontFamily: fonts.reading,
            fontSize: fs(12),
            lineHeight: fs(16),
            fontWeight: '600',
            color: '#FFF9F2',
            letterSpacing: 1,
          }}
        >
          {badge}
        </Text>
      </View>
    </View>
  );

  const a11yLabel = `${bookName ? `${bookName} · ` : ''}${year} 时光年鉴，${badge}`;

  if (ink.on) {
    return (
      <InkPress
        accessibilityLabel={a11yLabel}
        offset={3}
        radius={r(14)}
        underlay={dark ? '#000000' : ink.line}
        onPress={() => {
          haptic('light');
          onPress();
        }}
        faceStyle={faceStyle}
      >
        {inner}
      </InkPress>
    );
  }

  return (
    <PressableScale
      accessibilityLabel={a11yLabel}
      scaleTo={0.98}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={faceStyle}
    >
      {inner}
    </PressableScale>
  );
}

/* ---------------- D. 年鉴扉页（YearbookTitlePage） ---------------- */

export interface LedgerStat {
  label: string;
  val: string;
  unit?: string;
}

export function YearbookTitlePage({
  year,
  personaTitle,
  personaDesc,
  stats,
}: {
  year: number;
  personaTitle: string;
  personaDesc: string;
  stats: [LedgerStat, LedgerStat, LedgerStat, LedgerStat];
}) {
  const { fs, r, dark, ink, fonts } = useTheme();
  const paperBg = dark ? '#1B2226' : POSTCARD.paper;
  const inkMain = dark ? '#EAE4D7' : '#241F1B';
  const inkSub = dark ? '#A79F92' : '#655C52';
  const inkMuted = dark ? '#7E786E' : '#91877A';
  const outerBorder = ink.on ? (dark ? '#4B5E65' : ink.line) : dark ? '#333F46' : '#D5CCB8';
  const innerRule = dark ? 'rgba(234, 228, 215, 0.2)' : '#DFD6C2';
  const ledgerRule = dark ? 'rgba(234, 228, 215, 0.14)' : '#E6DEC9';

  const renderCell = (cell: LedgerStat, style?: ViewStyle) => (
    <View style={[{ flex: 1, alignItems: 'center', paddingVertical: 10 }, style]}>
      <Text numberOfLines={1} style={{ fontSize: fs(11.5), color: inkSub, letterSpacing: 0.5 }}>
        {cell.label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: SERIF_BOLD,
            fontSize: fs(22),
            lineHeight: fs(28),
            color: inkMain,
            fontVariant: ['tabular-nums'],
          }}
        >
          {cell.val}
        </Text>
        {!!cell.unit && <Text style={{ fontSize: fs(11.5), color: inkMuted }}>{cell.unit}</Text>}
      </View>
    </View>
  );

  return (
    <View
      style={{
        backgroundColor: paperBg,
        borderRadius: r(14),
        padding: 4,
        borderWidth: ink.on ? 1.5 : 1,
        borderColor: outerBorder,
        ...(ink.on
          ? { boxShadow: `0px 3px 0px ${dark ? '#000000' : ink.line}` }
          : !dark
            ? { shadowColor: '#2A2015', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 }
            : {}),
      }}
    >
      {/* 内嵌 4px 双细线书扉内框 */}
      <View
        style={{
          borderRadius: Math.max(2, r(14) - 3),
          borderWidth: 1,
          borderColor: innerRule,
          paddingHorizontal: 18,
          paddingTop: 20,
          paddingBottom: 14,
        }}
      >
        <Text
          style={{
            fontSize: fs(9.5),
            lineHeight: fs(13),
            letterSpacing: 2.2,
            color: inkMuted,
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          REMEMBER · ANNUAL ALMANAC
        </Text>

        <Text
          style={{
            fontFamily: SERIF_BOLD,
            fontSize: fs(36),
            lineHeight: fs(42),
            letterSpacing: 2,
            color: inkMain,
            textAlign: 'center',
            marginTop: 4,
            fontVariant: ['tabular-nums'],
          }}
        >
          {year}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          <Text
            style={{
              fontFamily: fonts.reading,
              fontSize: fs(16.5),
              lineHeight: fs(22),
              fontWeight: '600',
              letterSpacing: 3,
              color: inkMain,
            }}
          >
            时光年鉴
          </Text>
          {/* 朱砂藏书印章 */}
          <View
            style={{
              backgroundColor: '#C44E43',
              borderRadius: 3,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderWidth: 1,
              borderColor: 'rgba(255, 245, 235, 0.42)',
              transform: [{ rotate: '-2deg' }],
            }}
          >
            <Text
              style={{
                fontFamily: fonts.reading,
                fontSize: fs(10.5),
                lineHeight: fs(14),
                color: '#FFF8F0',
                fontWeight: '600',
                letterSpacing: 0.5,
              }}
            >
              {personaTitle}
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontSize: fs(12),
            lineHeight: Math.round(fs(12) * 1.6),
            color: inkSub,
            textAlign: 'center',
            marginTop: 8,
            paddingHorizontal: 8,
          }}
        >
          {personaDesc}
        </Text>

        {/* 菱花细线分隔 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15, marginBottom: 8 }}>
          <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: innerRule }} />
          <Text accessibilityElementsHidden aria-hidden style={{ fontSize: 10, lineHeight: 12, color: inkMuted }}>
            ◇
          </Text>
          <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: innerRule }} />
        </View>

        {/* 2×2 账册细线网格 */}
        <View>
          <View style={{ flexDirection: 'row' }}>
            {renderCell(stats[0], { paddingRight: 8 })}
            <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: ledgerRule, marginVertical: 4 }} />
            {renderCell(stats[1], { paddingLeft: 8 })}
          </View>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: ledgerRule, marginHorizontal: 6 }} />
          <View style={{ flexDirection: 'row' }}>
            {renderCell(stats[2], { paddingRight: 8 })}
            <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: ledgerRule, marginVertical: 4 }} />
            {renderCell(stats[3], { paddingLeft: 8 })}
          </View>
        </View>
      </View>
    </View>
  );
}

/* ---------------- E. 年度足迹扉页摘要（回顾页「年度」分栏） ---------------- */

export function YearbookFootprintPlate({
  stats,
  onOpenReport,
}: {
  stats: [LedgerStat, LedgerStat, LedgerStat];
  onOpenReport: () => void;
}) {
  const { fs, r, dark, ink, fonts } = useTheme();
  const paperBg = dark ? '#1B2226' : POSTCARD.paper;
  const inkMain = dark ? '#EAE4D7' : '#241F1B';
  const inkSub = dark ? '#A79F92' : '#655C52';
  const outerBorder = ink.on ? (dark ? '#4B5E65' : ink.line) : dark ? '#333F46' : '#D5CCB8';
  const innerRule = dark ? 'rgba(234, 228, 215, 0.18)' : '#E2DAC7';

  return (
    <View
      style={{
        backgroundColor: paperBg,
        borderRadius: r(14),
        padding: 4,
        borderWidth: ink.on ? 1.5 : 1,
        borderColor: outerBorder,
      }}
    >
      <View
        style={{
          borderRadius: Math.max(2, r(14) - 3),
          borderWidth: 1,
          borderColor: innerRule,
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text
            style={{
              fontFamily: fonts.reading,
              fontSize: fs(15),
              lineHeight: fs(21),
              fontWeight: '600',
              color: inkMain,
              letterSpacing: 0.5,
            }}
          >
            这一年的足迹
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptic('light');
              onOpenReport();
            }}
            style={({ pressed }) => ({
              minHeight: 44,
              marginVertical: -10,
              justifyContent: 'center',
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <View
              style={{
                backgroundColor: POSTCARD.vermilion,
                borderRadius: r(5),
                paddingHorizontal: 9,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontFamily: fonts.reading, fontSize: fs(11.5), color: '#FFF9F2', fontWeight: '600', letterSpacing: 0.5 }}>
                完整年鉴 ›
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: innerRule, marginVertical: 12 }} />

        <View style={{ flexDirection: 'row' }}>
          {stats.map((col, idx) => (
            <React.Fragment key={col.label}>
              {idx > 0 && <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: innerRule, marginVertical: 2 }} />}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text
                  style={{
                    fontFamily: SERIF_BOLD,
                    fontSize: fs(21),
                    lineHeight: fs(26),
                    color: inkMain,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {col.val}
                </Text>
                <Text style={{ fontSize: fs(11.5), color: inkSub, marginTop: 2 }}>{col.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>
    </View>
  );
}
