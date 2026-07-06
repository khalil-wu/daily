import { Platform } from 'react-native';

// 安卓 Material 动效思路：进入用 ease-out（减速，自然落位），退出用 ease-in（加速，比进入快），
// 按压用 spring 物理感（明显但不夸张的缩放 + 轻微弹性），手势跟手。
export const motion = {
  duration: {
    fast: 140,
    base: 220,
    sheetIn: 280,
    sheetOut: 180,
  },
  // 按压缩放更明显，让反馈可感知（Material state-layer 思路：状态变化要被看见）
  pressScale: 0.97,
  cardPressScale: 0.98,
  floatOffset: 1.5,
  useNativeDriver: Platform.OS !== 'web',
  // Spring 预设：Material 风格的物理弹性
  spring: {
    // 轻触反馈：快速回弹，轻微 bouncy
    tap: { speed: 32, bounciness: 6 },
    // 卡片按压：稳健一点
    card: { speed: 26, bounciness: 4 },
    // 弹层回弹：柔和有韧性
    sheet: { speed: 20, bounciness: 5 },
    // 拖拽松手回位：跟手感
    drag: { speed: 18, bounciness: 6 },
  },
};

