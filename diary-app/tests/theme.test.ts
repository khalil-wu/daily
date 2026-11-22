import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCENTS, STYLES, buildPalette, contrastRatio, ensureContrast, luminance, mixHex, scaleRadius, stylePreset,
} from '../src/theme/palette';

test('主题：六套风格、十种强调色，每种的文字对比度都达标', () => {
  const worst = { sub: 99, muted: 99, accent: 99, onPrimary: 99, status: 99 };
  for (const st of STYLES) {
    for (const dark of [false, true]) {
      for (const ac of ACCENTS) {
        const p = buildPalette(dark, ac.key, st.key);
        // 小字号辅助文字、输入提示和状态文字也需要 AA（4.5）。
        worst.sub = Math.min(worst.sub, contrastRatio(p.textSub, p.bg), contrastRatio(p.textSub, p.card));
        worst.muted = Math.min(worst.muted, ...[p.bg, p.card, p.inputBg].map(bg => contrastRatio(p.textMuted, bg)));
        worst.status = Math.min(worst.status, ...[p.danger, p.success, p.warning, p.info].flatMap(color => [p.bg, p.card].map(bg => contrastRatio(color, bg))));
        // 强调色当文字用：页面、卡片、浅强调底上都要能读
        worst.accent = Math.min(worst.accent, contrastRatio(p.primaryDark, p.bg), contrastRatio(p.primaryDark, p.card), contrastRatio(p.primaryDark, p.primaryFaint));
        // 压在强调色上的字
        worst.onPrimary = Math.min(worst.onPrimary, contrastRatio(p.textOnPrimary, p.primary));
        // 正文颜色必须读得清
        assert.ok(contrastRatio(p.text, p.bg) >= 10, `${st.key}/${dark ? 'dark' : 'light'} 正文对比度不足`);
        // 深浅两种模式的底色确实是深/浅
        assert.ok(dark ? luminance(p.bg) < 0.08 : luminance(p.bg) > 0.75, `${st.key} 底色明暗不对`);
      }
    }
  }
  assert.ok(worst.sub >= 4.5, `次要文字最差对比度 ${worst.sub.toFixed(2)}`);
  assert.ok(worst.muted >= 4.5, `辅助文字最差对比度 ${worst.muted.toFixed(2)}`);
  assert.ok(worst.status >= 4.5, `状态文字最差对比度 ${worst.status.toFixed(2)}`);
  assert.ok(worst.accent >= 4.5, `强调色文字最差对比度 ${worst.accent.toFixed(2)}`);
  assert.ok(worst.onPrimary >= 4.5, `强调色上的文字最差对比度 ${worst.onPrimary.toFixed(2)}`);
});

test('主题：利落风格不投影改用描边，深色强调色自动换亮', () => {
  for (const st of STYLES) {
    const p = buildPalette(false, 'latte', st.key);
    assert.equal(p.shadow === 'transparent', st.flat, `${st.key} flat 与投影不一致`);
  }
  // 墨黑在深色模式里换成纸白，在背景上必须读得清
  const inkDark = buildPalette(true, 'ink', 'ink');
  assert.notEqual(inkDark.primary, '#191919');
  assert.ok(contrastRatio(inkDark.textOnPrimary, inkDark.primary) >= 4);
});

test('主题：输入、选中与状态浅底的实际配对在所有组合里可读', () => {
  for (const st of STYLES) for (const dark of [false, true]) for (const ac of ACCENTS) {
    const p = buildPalette(dark, ac.key, st.key);
    const label = `${st.key}/${ac.key}/${dark}`;
    for (const surface of [p.bg, p.bgDeep, p.card, p.cardAlt, p.inputBg, p.primaryFaint]) {
      for (const text of [p.text, p.textSub, p.textMuted, p.primaryDark]) {
        assert.ok(contrastRatio(text, surface) >= 4.5, `${label}: ${text} on ${surface}`);
      }
    }
    for (const surface of [p.bg, p.card, p.inputBg]) {
      assert.ok(contrastRatio(p.controlBorder, surface) >= 3, `${label}: control outline`);
      assert.ok(contrastRatio(p.focusRing, surface) >= 3, `${label}: focus ring`);
    }
    for (const [text, bg] of [[p.primaryDark, p.primarySoft], [p.danger, p.dangerSoft], [p.success, p.successSoft], [p.warning, p.warningSoft], [p.textOnDanger, p.danger], [p.disabledText, p.disabledBg]]) {
      assert.ok(contrastRatio(text, bg) >= 4.5, `${label}: semantic text ${text} on ${bg}`);
    }
  }
});

test('主题：圆角随风格缩放，胶囊由风格决定，小圆角不动', () => {
  const cool = stylePreset('cool');
  const sakura = stylePreset('sakura');
  const ink = stylePreset('ink');
  assert.equal(scaleRadius(999, cool), cool.pill); // 清冷：胶囊变成小圆角
  assert.equal(scaleRadius(999, sakura), 999); // 樱雾：保持胶囊
  assert.equal(scaleRadius(4, cool), 4); // 细小圆角不动
  assert.ok(scaleRadius(20, cool) < scaleRadius(20, sakura));
  assert.equal(scaleRadius(10, ink), 3); // 墨白最锐利
  assert.equal(stylePreset('不存在'), STYLES[0]); // 坏值回落到温润
});

test('主题：颜色工具——混合、亮度、对比度、确保达标', () => {
  assert.equal(mixHex('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(mixHex('#FF0000', '#00FF00', 0), '#FF0000');
  assert.ok(Math.abs(luminance('#FFFFFF') - 1) < 0.001);
  assert.ok(Math.abs(luminance('#000000')) < 0.001);
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
  assert.ok(Math.abs(contrastRatio('#000000', '#FFFFFF') - 21) < 0.5);
  // 已经达标原样返回；不达标推到目标
  assert.equal(ensureContrast('#000000', ['#FFFFFF'], 4.5, '#000000'), '#000000');
  const pushed = ensureContrast('#AAAAAA', ['#FFFFFF'], 4.5, '#000000');
  assert.ok(contrastRatio(pushed, '#FFFFFF') >= 4.5);
});
