import { plainText } from '../text';

/** 全国统一心理援助热线（国家卫健委设置，2025 年 5 月起全国开通） */
export const HOTLINE = { number: '12356', name: '全国统一心理援助热线' };

const SIGNALS = [
  '自杀', '轻生', '不想活', '活不下去', '活着没意思', '活着没有意义', '结束生命', '结束自己', '了结自己',
  '想死', '去死', '死了算了', '一了百了', '自残', '割腕', '伤害自己', '遗书', '跳楼', '吞药',
];

/**
 * 文字里是否出现了自伤、轻生相关的表达。
 * 只做关键词判断、只在本机运行：命中时界面会给出求助电话，回信的提示词也会换成更谨慎的版本。
 * 宁可多提醒，也不漏掉。
 */
export function detectCrisis(text: string): boolean {
  const body = plainText(text || '').replace(/\s+/g, '');
  if (!body) return false;
  return SIGNALS.some(s => body.includes(s));
}
