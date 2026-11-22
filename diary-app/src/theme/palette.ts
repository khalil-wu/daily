/**
 * 配色与风格的纯计算部分（不依赖 react-native，可直接在测试里运行）。
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontScaleKey = 'standard' | 'large' | 'xlarge';
export type LineHeightKey = 'compact' | 'standard' | 'relaxed';

export interface Palette {
  primary: string;
  /** 强调色用作文字、图标时的颜色（浅色模式更深，深色模式更亮，保证看得清） */
  primaryDark: string;
  primarySoft: string;
  primaryFaint: string;
  bg: string;
  bgDeep: string;
  card: string;
  cardAlt: string;
  divider: string;
  border: string;
  /** Essential control outline; decorative card borders may remain softer. */
  controlBorder: string;
  focusRing: string;
  text: string;
  textSub: string;
  textMuted: string;
  /** 压在强调色上的文字 / 图标颜色 */
  textOnPrimary: string;
  textOnDanger: string;
  disabledBg: string;
  disabledText: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  overlay: string;
  shadow: string;
  inputBg: string;
}

/* ---------------- 颜色小工具 ---------------- */

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** 两个颜色按比例混合：t = 0 得到 a，t = 1 得到 b */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`.toUpperCase();
}

/** WCAG 相对亮度 */
export function luminance(hex: string): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = parseHex(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 对比度（1 ~ 21） */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * 把一个颜色朝黑或白推，直到它和所有给定底色的对比度都达到 target。
 * 已经达标就原样返回，所以手调好的颜色不会被改动。
 */
export function ensureContrast(color: string, against: string[], target: number, toward: '#000000' | '#FFFFFF'): string {
  const ok = (c: string) => against.every(bg => contrastRatio(c, bg) >= target);
  let out = color;
  for (let t = 0.05; !ok(out) && t <= 0.9; t += 0.05) out = mixHex(color, toward, t);
  return out;
}

/* ---------------- 强调色 ---------------- */

/** 强调色（外观里可选）。darkColor：深色模式下换用的颜色（例如墨黑在深色里变成纸白） */
export const ACCENTS = [
  { key: 'teal', name: '青笺', color: '#5AC4CA', darkColor: '#67D1D7' },
  { key: 'latte', name: '奶茶', color: '#8C6343', darkColor: '#B88D6B' },
  { key: 'rose', name: '藕粉', color: '#9F5A61', darkColor: '#C57F86' },
  { key: 'lavender', name: '雾紫', color: '#6C64A6', darkColor: '#968ECF' },
  { key: 'mist', name: '雾蓝', color: '#46729A', darkColor: '#6B9AC4' },
  { key: 'sage', name: '青苔', color: '#497A52', darkColor: '#74A57D' },
  { key: 'steel', name: '钢蓝', color: '#3F6487', darkColor: '#7FA6CC' },
  { key: 'ink', name: '墨黑', color: '#191919', darkColor: '#ECEAE6' },
  { key: 'vermilion', name: '朱砂', color: '#B4472F', darkColor: '#D9705A' },
  { key: 'pine', name: '松绿', color: '#3F7A63', darkColor: '#6DB094' },
  { key: 'iris', name: '鸢尾', color: '#5B5BD6', darkColor: '#8E8CF0' },
  { key: 'starlight', name: '星光', color: '#4F5FB8', darkColor: '#9AA8F0' },
  { key: 'indigo', name: '靛青', color: '#3D4A8F', darkColor: '#8792D6' },
] as const;
export type AccentKey = (typeof ACCENTS)[number]['key'];

/* ---------------- 风格 ---------------- */

/** 不含强调色的中性色板 */
interface Neutral {
  bg: string;
  bgDeep: string;
  card: string;
  cardAlt: string;
  divider: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  inputBg: string;
  overlay: string;
  shadow: string;
}

export type StyleKey = 'companion' | 'editorial' | 'warm' | 'cool' | 'ink' | 'forest' | 'sakura' | 'kraft' | 'vivid' | 'midnight';

export interface StylePreset {
  key: StyleKey;
  name: string;
  desc: string;
  /** 选中这个风格时一并换上的强调色（之后仍可单独改） */
  accent: AccentKey;
  /** 圆角缩放：1 = 设计稿原值，越小越利落 */
  radius: number;
  /** 胶囊形控件（按钮、标签）的圆角；999 表示保持胶囊 */
  pill: number;
  /** 卡片是否投影。利落的风格不投影，改用清晰的描边 */
  flat: boolean;
  light: Neutral;
  dark: Neutral;
}

export const STYLES: StylePreset[] = [
  {
    key: 'companion', name: '线绘陪伴', desc: '手绘墨线、清新青调与小鸟陪伴', accent: 'teal', radius: 0.9, pill: 999, flat: true,
    light: {
      bg: '#F7FAFA', bgDeep: '#EAF4F5', card: '#FFFFFF', cardAlt: '#F1FCFD', divider: '#D6E7E9', border: '#C6DADD',
      text: '#1C2629', textSub: '#526267', textMuted: '#7E8F95', inputBg: '#EFF7F8', overlay: 'rgba(24,34,37,0.46)', shadow: '#1C2629',
    },
    dark: {
      bg: '#101618', bgDeep: '#0B1012', card: '#182124', cardAlt: '#1E292D', divider: '#28363B', border: '#3F565E',
      text: '#ECF4F5', textSub: '#A1B4BA', textMuted: '#6D8188', inputBg: '#1B2529', overlay: 'rgba(0,0,0,0.64)', shadow: '#000000',
    },
  },
  {
    key: 'editorial', name: '杂志', desc: '净白底、墨色标题、雾蓝点缀', accent: 'mist', radius: 0.65, pill: 999, flat: false,
    light: {
      bg: '#F7F7F5', bgDeep: '#EDEDEB', card: '#FFFFFF', cardAlt: '#FAFAF9', divider: '#E6E6E3', border: '#D6D6D1',
      text: '#20211F', textSub: '#5B5C58', textMuted: '#8F8F8A', inputBg: '#F1F1EE', overlay: 'rgba(24,26,25,0.46)', shadow: '#3A3D38',
    },
    dark: {
      bg: '#101214', bgDeep: '#0B0D0F', card: '#191C1F', cardAlt: '#1E2125', divider: '#2A2E33', border: '#383D44',
      text: '#EDEFF0', textSub: '#A3AAB1', textMuted: '#6E767E', inputBg: '#1D2126', overlay: 'rgba(0,0,0,0.62)', shadow: '#000000',
    },
  },
  {
    key: 'warm', name: '温润', desc: '米白纸张与暖棕墨色', accent: 'latte', radius: 0.8, pill: 999, flat: false,
    light: {
      bg: '#F8F5EF', bgDeep: '#EFE9E0', card: '#FFFFFF', cardAlt: '#FBF8F4', divider: '#E8E0D6', border: '#DCD2C6',
      text: '#26211D', textSub: '#6B645D', textMuted: '#9C938A', inputBg: '#F3EEE7', overlay: 'rgba(38,33,29,0.46)', shadow: '#8A6E58',
    },
    dark: {
      bg: '#1A1714', bgDeep: '#141210', card: '#25211D', cardAlt: '#2A2521', divider: '#38312B', border: '#453D36',
      text: '#F1EAE2', textSub: '#B3A99E', textMuted: '#82786E', inputBg: '#2C2723', overlay: 'rgba(0,0,0,0.6)', shadow: '#000000',
    },
  },
  {
    key: 'cool', name: '清冷', desc: '冷灰蓝、细线、少圆角', accent: 'steel', radius: 0.5, pill: 7, flat: true,
    light: {
      bg: '#F3F5F7', bgDeep: '#E8ECF0', card: '#FFFFFF', cardAlt: '#F8FAFB', divider: '#DFE4EA', border: '#C9D1DA',
      text: '#16202B', textSub: '#535F6C', textMuted: '#8792A0', inputBg: '#ECEFF3', overlay: 'rgba(16,24,34,0.48)', shadow: '#1B2A3A',
    },
    dark: {
      bg: '#0F1318', bgDeep: '#0A0D11', card: '#171C23', cardAlt: '#1C222A', divider: '#28303A', border: '#364050',
      text: '#E7ECF1', textSub: '#9EA9B5', textMuted: '#6C7784', inputBg: '#1B2129', overlay: 'rgba(0,0,0,0.62)', shadow: '#000000',
    },
  },
  {
    key: 'ink', name: '墨白', desc: '黑白分明，像一页排好的书', accent: 'ink', radius: 0.25, pill: 3, flat: true,
    light: {
      bg: '#FAFAF8', bgDeep: '#EFEFEB', card: '#FFFFFF', cardAlt: '#F5F5F2', divider: '#E1E1DC', border: '#BDBDB6',
      text: '#111111', textSub: '#4F4F4C', textMuted: '#888884', inputBg: '#F0F0EC', overlay: 'rgba(0,0,0,0.5)', shadow: '#000000',
    },
    dark: {
      bg: '#0B0B0B', bgDeep: '#060606', card: '#151515', cardAlt: '#1A1A1A', divider: '#2A2A2A', border: '#444444',
      text: '#F3F3F0', textSub: '#A6A6A2', textMuted: '#70706D', inputBg: '#1B1B1B', overlay: 'rgba(0,0,0,0.66)', shadow: '#000000',
    },
  },
  {
    key: 'forest', name: '森野', desc: '苔绿与雾白，安静自然', accent: 'pine', radius: 0.7, pill: 999, flat: false,
    light: {
      bg: '#F2F5EE', bgDeep: '#E6EBE0', card: '#FFFFFF', cardAlt: '#F8FAF5', divider: '#DCE3D5', border: '#C8D2BF',
      text: '#1D2820', textSub: '#56645A', textMuted: '#889489', inputBg: '#EBF0E6', overlay: 'rgba(22,32,25,0.46)', shadow: '#3D5245',
    },
    dark: {
      bg: '#101411', bgDeep: '#0B0E0C', card: '#181E1A', cardAlt: '#1D241F', divider: '#29322C', border: '#37423A',
      text: '#E8EEE9', textSub: '#A0ADA3', textMuted: '#6E7A71', inputBg: '#1C231E', overlay: 'rgba(0,0,0,0.6)', shadow: '#000000',
    },
  },
  {
    key: 'sakura', name: '樱雾', desc: '柔粉、圆润，轻一点软一点', accent: 'rose', radius: 1.15, pill: 999, flat: false,
    light: {
      bg: '#FBF4F4', bgDeep: '#F4E8E8', card: '#FFFFFF', cardAlt: '#FDF8F8', divider: '#EEDFDF', border: '#E3CFCF',
      text: '#32262A', textSub: '#76656A', textMuted: '#A5949A', inputBg: '#F7EDED', overlay: 'rgba(50,38,42,0.44)', shadow: '#A8747C',
    },
    dark: {
      bg: '#191416', bgDeep: '#130F11', card: '#231C1F', cardAlt: '#292124', divider: '#372D31', border: '#44383D',
      text: '#F2E8EA', textSub: '#B5A5AA', textMuted: '#83757A', inputBg: '#2A2225', overlay: 'rgba(0,0,0,0.6)', shadow: '#000000',
    },
  },
  {
    key: 'kraft', name: '旧纸', desc: '牛皮纸与朱砂，像老笔记本', accent: 'vermilion', radius: 0.35, pill: 4, flat: true,
    light: {
      bg: '#EFE6D4', bgDeep: '#E3D8C2', card: '#F8F1E2', cardAlt: '#F3EBDA', divider: '#D9CCB3', border: '#BBA988',
      text: '#2B2317', textSub: '#655842', textMuted: '#93856C', inputBg: '#E9DEC9', overlay: 'rgba(43,35,23,0.5)', shadow: '#5E4B2E',
    },
    dark: {
      bg: '#19150F', bgDeep: '#120F0A', card: '#231D15', cardAlt: '#292219', divider: '#392F22', border: '#4A3E2E',
      text: '#F0E7D6', textSub: '#B4A78F', textMuted: '#837760', inputBg: '#2A2319', overlay: 'rgba(0,0,0,0.62)', shadow: '#000000',
    },
  },
  {
    key: 'vivid', name: '彩色时刻', desc: '明快渐变与彩色形状，像一本拼色手账', accent: 'iris', radius: 1.05, pill: 999, flat: false,
    light: {
      bg: '#F6F6FB', bgDeep: '#ECECF6', card: '#FFFFFF', cardAlt: '#F9F9FD', divider: '#E4E4F0', border: '#D3D3E4',
      text: '#1E1E2E', textSub: '#5A5A72', textMuted: '#8A8AA2', inputBg: '#EFEFF7', overlay: 'rgba(22,22,40,0.46)', shadow: '#4B4B8F',
    },
    dark: {
      bg: '#121222', bgDeep: '#0C0C18', card: '#1B1B2F', cardAlt: '#212136', divider: '#2C2C44', border: '#3A3A56',
      text: '#EEEEF8', textSub: '#A9A9C4', textMuted: '#73738F', inputBg: '#20203A', overlay: 'rgba(0,0,0,0.62)', shadow: '#000000',
    },
  },
  {
    key: 'midnight', name: '深蓝星笺', desc: '深蓝夜色与星光，适合夜里慢慢写', accent: 'starlight', radius: 0.9, pill: 999, flat: false,
    light: {
      bg: '#F2F4FA', bgDeep: '#E6E9F4', card: '#FFFFFF', cardAlt: '#F7F8FC', divider: '#DEE2EF', border: '#C9CFE3',
      text: '#161C38', textSub: '#525A7A', textMuted: '#868DA8', inputBg: '#ECEFF7', overlay: 'rgba(14,20,48,0.5)', shadow: '#26306A',
    },
    dark: {
      bg: '#0D1330', bgDeep: '#090E24', card: '#151C3E', cardAlt: '#1B2348', divider: '#262F58', border: '#354070',
      text: '#ECEFFC', textSub: '#A6AED0', textMuted: '#727BA0', inputBg: '#1A2246', overlay: 'rgba(0,0,0,0.64)', shadow: '#000000',
    },
  },
];

export function stylePreset(key?: StyleKey | string): StylePreset {
  return STYLES.find(s => s.key === key) ?? STYLES[0];
}

export function buildPalette(dark: boolean, accentKey: AccentKey, styleKey: StyleKey = 'warm'): Palette {
  const a: { color: string; darkColor?: string } = ACCENTS.find(x => x.key === accentKey) ?? ACCENTS[0];
  const st = stylePreset(styleKey);
  const n = dark ? st.dark : st.light;
  const primary = dark ? a.darkColor ?? a.color : a.color;
  const toward = dark ? '#FFFFFF' : '#000000';
  const primarySoft = mixHex(primary, n.card, dark ? 0.66 : 0.72);
  const primaryFaint = mixHex(primary, n.bg, dark ? 0.84 : 0.9);
  const surfaces = [n.bg, n.bgDeep, n.card, n.cardAlt, n.inputBg, primaryFaint];
  const dangerSoft = dark ? mixHex('#E07B6F', n.card, 0.8) : '#F8E3DF';
  const successSoft = dark ? mixHex('#8DB78D', n.card, 0.82) : '#E2EFE2';
  const warningSoft = dark ? mixHex('#E8B062', n.card, 0.82) : '#FAEBD5';
  const danger = ensureContrast(dark ? '#E07B6F' : '#C8554A', [...surfaces, dangerSoft], 4.5, toward);
  // 强调色做文字时：浅色底上压深、深色底上提亮，直到在页面、卡片和浅强调底上都读得清（WCAG AA 4.5）
  const accentText = ensureContrast(mixHex(primary, toward, dark ? 0.3 : 0.2), [...surfaces, primarySoft], 4.6, toward);
  // 压在强调色上的字：白字够清楚就用白字，否则用深色字
  const onWhite = contrastRatio('#FFFFFF', primary);
  const textOnPrimary = onWhite >= 4.5 ? '#FFFFFF' : ensureContrast('#161616', [primary], 4.5, '#000000');
  return {
    primary,
    primaryDark: accentText,
    primarySoft,
    primaryFaint,
    ...n,
    controlBorder: ensureContrast(n.border, [n.bg, n.card, n.inputBg], 3, toward),
    focusRing: accentText,
    // 辅助文字也用于小字号正文和占位符，统一达到 WCAG AA 4.5:1。
    textMuted: ensureContrast(n.textMuted, surfaces, 4.5, toward),
    textSub: ensureContrast(n.textSub, surfaces, 4.5, toward),
    textOnPrimary,
    textOnDanger: contrastRatio('#FFFFFF', danger) >= 4.5 ? '#FFFFFF' : '#161616',
    disabledBg: n.inputBg,
    disabledText: ensureContrast(n.textSub, [n.inputBg], 4.5, toward),
    danger, dangerSoft,
    success: ensureContrast(dark ? '#8DB78D' : '#5F9468', [...surfaces, successSoft], 4.5, toward),
    successSoft,
    warning: ensureContrast(dark ? '#E8B062' : '#D4912F', [...surfaces, warningSoft], 4.5, toward),
    warningSoft,
    info: ensureContrast(dark ? '#86ABCB' : '#5585B0', surfaces, 4.5, toward),
    // 利落的风格不投影：阴影色给成透明，所有 shadowColor: c.shadow 的卡片随之变平
    shadow: st.flat ? 'transparent' : n.shadow,
  };
}

/**
 * 圆角随风格缩放。
 * - 999 这类「胶囊」值：圆润风格保持胶囊，利落风格换成小圆角
 * - 4 以下的细小圆角（进度条、小圆点）不动
 */
export function scaleRadius(n: number, st: Pick<StylePreset, 'radius' | 'pill'>): number {
  if (n >= 500) return st.pill;
  if (n <= 4) return n;
  return Math.max(2, Math.round(n * st.radius));
}
