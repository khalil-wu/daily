import { chromium, type Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { defaultState } from '../../src/store/storage';
import { buildSampleEntries } from '../../src/data/samples';

const base = process.env.DIARY_TEST_URL || 'http://127.0.0.1:8765';
const outputRoot = process.env.DIARY_STATE_OUTPUT || 'docs/research';
const entries = buildSampleEntries(new Date(2026, 10, 21, 18).getTime());
entries[0].id = 'audit-entry';
const state = { ...defaultState(), entries, onboarded: true, tutorialSeen: true, editorTourSeen: true, backup: { auto: false } };
await mkdir(`${outputRoot}/states`, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report: object[] = [];
type Scenario = { id: string; route: string; title: string; width?: number; height?: number; darkLarge?: boolean; denyMic?: boolean; action: (page: Page) => Promise<void> };
const scenarios: Scenario[] = [
  { id: 'date-sheet', route: '/write?id=audit-entry', title: '日期选择面板', action: async p => { await p.getByText('11月21日 15:24 周六', { exact: true }).click(); await p.getByText('记录时间', { exact: true }).waitFor(); } },
  { id: 'time-sheet', route: '/write?id=audit-entry', title: '时间轮盘面板', action: async p => { await p.getByText('11月21日 15:24 周六', { exact: true }).click(); await p.getByRole('tab', { name: '时间', exact: true }).click(); } },
  { id: 'exit-save', route: '/write?id=audit-entry', title: '退出保存修改确认', action: async p => { await p.getByLabel('日记正文', { exact: true }).fill('本次仅用于界面审计的合成改动'); await p.getByRole('button', { name: '取消', exact: true }).click(); await p.getByText('保存这次修改？', { exact: true }).waitFor(); } },
  { id: 'exit-draft-320', route: '/write', title: '窄屏退出草稿确认', width: 320, height: 568, action: async p => { await p.getByLabel('日记正文', { exact: true }).fill('尚未完成的合成草稿'); await p.getByRole('button', { name: '取消', exact: true }).click(); await p.getByText('保存这篇草稿？', { exact: true }).waitFor(); } },
  { id: 'photo-viewer', route: '/memory/audit-entry', title: '照片全屏查看', action: async p => { await p.locator('img').first().click(); await p.getByText('1 / 2', { exact: true }).waitFor(); } },
  { id: 'new-tag', route: '/picker/tags', title: '新建标签底部面板', action: async p => { await p.getByText('新建标签', { exact: true }).click(); await p.getByPlaceholder('输入标签名称（如：摄影、冥想）').fill('清晨散步'); } },
  { id: 'new-person', route: '/picker/people', title: '新建人物底部面板', action: async p => { await p.getByText('记下一个人', { exact: true }).click(); await p.getByPlaceholder('TA 的名字或你对 TA 的称呼').fill('小林'); } },
  { id: 'toast-validation', route: '/picker/tags', title: '标签错误在面板内就地提示', action: async p => { await p.getByText('新建标签', { exact: true }).click(); await p.getByRole('button', { name: '创建标签', exact: true }).click(); await p.getByText('请输入标签名称', { exact: true }).waitFor(); } },
  { id: 'permission-intro', route: '/settings/about', title: '权限说明面板', action: async p => { await p.getByText('权限说明与授权', { exact: true }).click(); await p.getByRole('dialog', { name: '记录权限', exact: true }).waitFor(); } },
  { id: 'permission-denied', route: '/picker/audio', title: '麦克风拒绝后的真实错误状态', denyMic: true, action: async p => { await p.getByRole('button', { name: '开始录音', exact: true }).click(); await p.getByText('无法开始录音，请检查麦克风权限后重试', { exact: true }).waitFor(); } },
  { id: 'privacy-policy', route: '/auth/register', title: '隐私政策长说明底部面板', action: async p => { await p.getByText('《隐私政策》', { exact: true }).click(); await p.getByRole('button', { name: '我知道了', exact: true }).waitFor(); } },
  { id: 'ai-consent', route: '/settings/ai', title: 'AI说明确认弹窗', action: async p => { await p.getByRole('switch').first().click(); await p.getByText('开启「记得」之前', { exact: true }).waitFor(); } },
  { id: 'ai-consent-dark-320', route: '/settings/ai', title: '窄屏深色大字号AI说明', width: 320, height: 568, darkLarge: true, action: async p => { await p.getByRole('switch').first().click(); await p.getByText('开启「记得」之前', { exact: true }).waitFor(); } },
  { id: 'destructive-confirm', route: '/settings/privacy', title: '清空数据危险操作确认（未执行）', action: async p => { await p.getByText('清空所有数据', { exact: true }).click(); await p.getByRole('button', { name: '确认清空', exact: true }).waitFor(); } },
  { id: 'entry-actions', route: '/memory/audit-entry', title: '日记更多操作Sheet', action: async p => { await p.getByRole('button', { name: '更多', exact: true }).click(); await p.getByText('删除日记', { exact: true }).waitFor(); } },
];
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: { width: scenario.width || 390, height: scenario.height || 844 }, reducedMotion: 'reduce', locale: 'zh-CN' });
    const initial = scenario.darkLarge ? { ...state, appearance: { ...state.appearance, theme: 'dark', fontScale: 'xlarge' } } : state;
    await context.addInitScript(seed => localStorage.setItem('jide-diary:state:v1', JSON.stringify(seed)), initial);
    if (scenario.denyMic) await context.addInitScript("Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: function auditDeniedMicrophone() { return Promise.reject(new DOMException('Audit fixture: permission denied', 'NotAllowedError')); } });");
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + scenario.route, { waitUntil: 'networkidle' });
      page.setDefaultTimeout(7000);
      await scenario.action(page);
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${outputRoot}/states/${scenario.id}.png` });
      const details = await page.evaluate(() => ({
        text: document.body.innerText,
        dialogs: Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"]')).map(el => ({ text: el.textContent, label: el.getAttribute('aria-label') })),
        focused: document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName,
        switches: Array.from(document.querySelectorAll('[role="switch"]')).map(el => ({ checked: el.getAttribute('aria-checked'), disabledAncestor: el.closest('[aria-disabled="true"]')?.outerHTML.slice(0, 600) || null })),
        visibleActions: Array.from(document.querySelectorAll('[role="button"]')).filter(el => { const r=el.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight; }).map(el => el.getAttribute('aria-label') || el.textContent),
      }));
      report.push({ id: scenario.id, title: scenario.title, route: scenario.route, width: scenario.width || 390, height: scenario.height || 844, screenshot: `states/${scenario.id}.png`, errors, ...details });
      console.log(scenario.id + ': captured');
    } catch (error) { report.push({ id: scenario.id, error: String(error), errors }); console.log(scenario.id + ': FAILED ' + String(error)); }
    await context.close();
  }
  await writeFile(`${outputRoot}/state-observations.json`, JSON.stringify(report, null, 2));
} finally { await browser.close(); }
