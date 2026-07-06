import { StyleSheet, type ViewStyle } from 'react-native';

import { colors, radius, shadows, strokeWidth } from './tokens';

// 日系圆体卡通（Claymorphism）贴纸语言的三档描边预设。
// 全项目次级元素统一 spread 这些预设，避免再退回发丝线/浅色 1px 边。
// 主卡片见 SectionCard；这里把同一套语言下放到 sheet / chip / 卡内 pill / 缩略图。

// 卡片级：粗描边 + 圆角 + 贴纸投影。用于弹层 sheet、独立面板。
export const stickerCard: ViewStyle = {
  borderWidth: strokeWidth.card,
  borderColor: colors.stroke,
  borderRadius: radius.card,
  ...shadows.card,
};

// 漫画分镜面板级：加重描边 + 更大圆角 + 强投影，用于 hero / 强调区块。
export const stickerPanel: ViewStyle = {
  borderWidth: strokeWidth.heavy,
  borderColor: colors.stroke,
  borderRadius: radius.card + 4,
  ...shadows.accent,
};

// chip/小按钮级：中等描边 + 按钮圆角 + 轻投影。用于 pill、筛选 chip、次级按钮。
export const stickerChip: ViewStyle = {
  borderWidth: strokeWidth.input,
  borderColor: colors.stroke,
  borderRadius: radius.button,
  ...shadows.card,
};

// 卡内嵌入级：细描边、无投影（避免卡中卡叠影）。用于卡片内部的 pill、缩略图、标签。
export const stickerInset: ViewStyle = {
  borderWidth: strokeWidth.input,
  borderColor: colors.stroke,
  borderRadius: radius.input,
};

// chip 选中态：accent 实底 + 墨线描边。文字应使用 textPrimary 而非白色以保证对比度。
export const stickerChipActive: ViewStyle = {
  backgroundColor: colors.accent,
  borderColor: colors.stroke,
};

export const surfaces = StyleSheet.create({
  stickerCard,
  stickerPanel,
  stickerChip,
  stickerInset,
  stickerChipActive,
});
