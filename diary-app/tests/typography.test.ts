import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFontRoles, resolveTextFont, type FontFamilyKey } from '../src/theme/typography';

test('阅读字体选择不改变界面字体；原生字体加载失败仍有可用字族', () => {
  for (const platform of ['web', 'ios', 'android']) {
    const ui = resolveFontRoles('sans', platform, true).ui;
    for (const family of ['serif', 'sans', 'kai'] as FontFamilyKey[]) {
      for (const ready of [false, true]) {
        const fonts = resolveFontRoles(family, platform, ready);
        assert.equal(fonts.ui, ui);
        assert.equal(resolveTextFont(fonts, 'ui').fontFamily, ui);
        assert.ok(fonts.reading.length > 0);
      }
    }
    const unloaded = resolveFontRoles('serif', platform, false);
    if (platform === 'web') {
      assert.match(unloaded.reading, /Songti SC/); // CSS swap can use the installed fallback immediately.
    } else {
      assert.equal(unloaded.reading, ui);
      assert.equal(unloaded.readingBold, undefined);
      assert.equal(resolveTextFont(unloaded, 'reading', undefined, '600').fontFamily, ui);
    }
  }
});

test('正文粗体使用真实字重，保留显式等宽/其他字族', () => {
  for (const platform of ['ios', 'android', 'web']) {
    const fonts = resolveFontRoles('serif', platform, true);
    assert.equal(resolveTextFont(fonts, 'reading', undefined, '400').fontFamily, fonts.reading);
    for (const weight of ['bold', '600', 700, '900']) {
      const bold = resolveTextFont(fonts, 'reading', undefined, weight);
      assert.equal(bold.fontFamily, fonts.readingBold);
      assert.equal(bold.fontWeight, platform === 'web' ? undefined : 'normal');
      // Legacy bodySerif styles are explicit families and still get the bundled bold face.
      assert.equal(resolveTextFont(fonts, 'ui', fonts.reading, weight).fontFamily, fonts.readingBold);
    }
    assert.deepEqual(resolveTextFont(fonts, 'reading', 'monospace', '700'), { fontFamily: 'monospace' });
    assert.equal(resolveTextFont(fonts, 'ui', fonts.ui, '700').fontFamily, fonts.ui);
  }
});

test('Android 楷体使用明确系统回退，网页没有字体文件也可阅读', () => {
  assert.equal(resolveFontRoles('kai', 'android', false).reading, 'serif');
  assert.equal(resolveFontRoles('kai', 'ios', false).reading, 'Kaiti SC');
  assert.match(resolveFontRoles('kai', 'web', false).reading, /serif$/);
});
