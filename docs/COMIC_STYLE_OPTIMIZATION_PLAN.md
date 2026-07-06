# 记得日记 — 漫画风格优化计划

> 基于 `ui-ux-pro-max` skill 全量审查 + 逐页代码审计  
> 审查范围：5 个 Tab 页 + 8 个子页面 + 全部组件 + 主题系统  
> 技术栈：Expo 57 / React Native 0.86 / React 19 / Zustand 5

---

## 一、总体评估

### 当前风格定位

项目已采用 **Claymorphism（日系圆体卡通贴纸风）**：
- 暖棕主色 `#E89B5B` + 深棕描边 `#5A3A22` + 奶油背景 `#FFF8EE`
- 标题字体：ZCOOL KuaiLe（站酷快乐体）/ Fredoka
- 正文字体：Nunito / 系统圆体
- 2.5px 粗描边 + 贴纸投影 + 圆角 18-20px
- 底部 Tab 5 项，符合 `bottom-nav-limit` 规则

**评分：风格一致性 8/10** — 已有明确的卡通视觉语言，但部分页面偏离贴纸风。

### 与 UI/UX Pro Max 推荐对比

| 维度 | 推荐方向 | 当前状态 | 差距 |
|------|----------|----------|------|
| 风格 | Claymorphism / Soft UI | ✅ 已采用 | 部分页面描边和阴影不一致 |
| 配色 | 暖棕 + ink violet accent | ⚠️ 缺少辅助强调色 | 只有单色调橙色系 |
| 字体 | Caveat(标题) + Quicksand(正文) | ⚠️ 用了 ZCOOL KuaiLe + Nunito | 可接受，但 Web 端加载慢 |
| 触控 | 44×44pt 最小 | ✅ 基本达标 | 个别图标按钮偏小 |
| 暗色模式 | 完整支持 | ✅ 有暗色 token | Native 端不会跟随系统切换 |
| 可访问性 | WCAG AA 4.5:1 | ⚠️ 部分文字对比度不足 | textTertiary 在浅色背景上偏低 |

---

## 二、逐页审查

### 1. 首页 `app/(tabs)/home.tsx`

**设计状态：良好**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 标题字体大小 | ✅ | `typography.display` = 28px，符合移动端标题 |
| 辅助文字 | ✅ | heroHint 用 `caption` = 13px |
| 触控目标 | ✅ | 搜索按钮 44×44，新建按钮 44×44 |
| 星图节点 | ⚠️ | `hitSlop={8}` 但节点本身可能 < 44pt |
| 指标卡 | ✅ | 可点击，有 pressed 状态 |
| 底部 CTA | ✅ | PrimaryButton 54px 高 |
| 空状态 | ✅ | 有引导文案和操作按钮 |

**问题：**
1. 星图 `FloatingNode` 的 `Pressable` 没有设置 `accessibilityRole` 和 `accessibilityLabel`
2. 星图人物节点标签 `fontSize: typography.caption` = 13px，在 375px 屏幕上偏小
3. `metricLabel` 用 `caption` = 13px，3 个指标卡横排时可能挤压
4. `privateStripText` 用 `caption` = 13px，但它是 `paddingVertical: spacing.xs` = 4px，触控高度不足 44pt（虽然它是信息条不是按钮，但当前做了 Pressable）

**优化建议：**
- 给星图节点补充 `accessibilityRole="button"` 和 `accessibilityLabel`
- `metricLabel` 考虑加到 14px 或确保 375px 宽度下不换行
- 私密记忆条如果可点击，增大触控区域到至少 44pt 高

---

### 2. 身边人 `app/(tabs)/people.tsx`

**设计状态：良好**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 标题 | ✅ | `titleLg` = 22px |
| 副标题 | ✅ | `caption` = 13px |
| 新增按钮 | ✅ | 44×44 |
| 人物卡片 | ✅ | SectionCard + pressed 反馈 + spring scale |
| 头像 | ✅ | 52px |
| 人物名 | ✅ | `title` = 17px |
| 人物备注 | ✅ | `body` = 16px |

**问题：**
1. `personMeta` 和 `subtitle` 没有设置 `fontFamily`（只有 `fontSize`），会回退到 `applyTypographyDefaults` 的默认 sans，和页面其他 display 字体不统一
2. 人物列表使用 `ScrollView` 而非 `FlatList`，超过 50 人时性能会下降（违反 `virtualize-lists` 规则）

**优化建议：**
- 给 `personMeta` 和 `subtitle` 补充 `fontFamily: typography.fontFamily.display`
- 人物列表改用 `FlatList` 并设置 `keyExtractor`、`getItemLayout`

---

### 3. 从前（时间线）`app/(tabs)/timeline.tsx`

**设计状态：良好**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 标题 | ✅ | `display` = 28px |
| 筛选 chip | ✅ | `minHeight: 42`（略低于 44pt 建议但可接受） |
| 年份标签 | ✅ | `caption` = 13px |
| 记忆卡片 | ✅ | MemoryCard 组件 |
| 空状态 | ✅ | 有文案 |
| 清空筛选 | ✅ | 44×44 |

**问题：**
1. 筛选 chip `minHeight: 42` 不满足 44pt 最小触控目标（违反 `touch-target-size`）
2. 多行水平 `ScrollView` 筛选器（年份、人物、心情、标签）可能造成 `gesture-conflicts`，虽然有 `showsHorizontalScrollIndicator={false}`
3. 时间线列表用 `ScrollView` + `.map()` 渲染所有卡片，大量记忆时性能差（违反 `virtualize-lists`）
4. `filterChipActive` 的文字颜色 `colors.bgPaper`（白色）在 `colors.accent`（#E89B5B）上的对比度需要验证

**对比度验证：**
- `#FFFFFF` on `#E89B5B`：对比度 ≈ 2.3:1 ❌ 不满足 WCAG AA 4.5:1
- 建议改用 `colors.textPrimary`（#3D2E22）作为选中态文字色，对比度 ≈ 4.8:1 ✅

**优化建议：**
- 筛选 chip `minHeight` 改为 44
- 时间线改用 `FlatList` 虚拟化
- 选中态文字色从 `bgPaper`（白）改为 `textPrimary`（深棕）或加深 accent 色到 `#C97A35`

---

### 4. 灵感墙（社区）`app/(tabs)/community.tsx`

**设计状态：中等，需要改进**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 标题 | ✅ | `titleLg` = 22px |
| 图标按钮 | ✅ | 44×44 三个 |
| 话题 chip | ✅ | `minHeight: 40`（偏低） |
| 帖子标题 | ✅ | `body` = 16px |
| 帖子正文 | ✅ | `body` = 16px, reading 字体 |
| 收藏按钮 | ⚠️ | `minHeight: 32`，远低于 44pt |
| 操作行 | ⚠️ | `minHeight: 36`，`minWidth: 66` |
| 空状态 | ✅ | 有图标+标题+说明 |

**问题：**
1. **话题 chip `minHeight: 40` 不满足 44pt 触控标准**
2. **收藏按钮 `minHeight: 32`** 严重违反 `touch-target-size` 规则
3. **操作行（阅读/喜欢）`minHeight: 36`** 不满足触控标准
4. 社区帖子列表用 `.map()` 渲染，无虚拟化
5. `followText` 用 `micro` = 11px，低于可读性建议
6. 帖子封面图 `height: 190` 固定高度，缺少 `aspect-ratio` 或响应式处理
7. **社区是"伪社区"** — 所有帖子都是"我"发布的，没有真实社交闭环
8. 通知弹层只显示"暂时没有新的互动"，功能不完整
9. 话题 Tab "推荐/收藏/附近/热门"中，"附近"依赖位置但无权限引导，"热门"排序逻辑简单

**优化建议：**
- 所有不满足 44pt 的按钮统一改为 `minHeight: 44`
- `followText` 从 `micro` 改为 `caption` = 13px
- 帖子列表改用 `FlatList`
- 封面图改用 `aspectRatio: 16/9` 替代固定高度
- 补充评论系统（P1 功能）
- 通知页补充真实互动数据

---

### 5. 我 `app/(tabs)/me.tsx`

**设计状态：良好**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 头像 | ✅ | 72px |
| 标题 | ✅ | `titleLg` = 22px |
| 副标题 | ✅ | `body` = 16px |
| 设置项 | ✅ | SectionCard + chevron |
| 开关 | ✅ | 系统 Switch |
| PIN 输入 | ✅ | `height: 52` |
| 模态 | ✅ | 有遮罩、关闭路径 |

**问题：**
1. `subtitle`、`settingDesc`、`statLabel` 没有 `fontFamily`（回退到默认 sans）
2. PIN 输入框 `fontSize: typography.title` = 17px，在 `secureTextEntry` 模式下可能显示为圆点偏小
3. "之后"卡片只有信息没有操作，但用了 `SectionCard`（卡片样式），视觉上像可点击

**优化建议：**
- 补充缺失的 `fontFamily`
- "之后"卡片改为纯文本信息块或加上"了解更多"操作
- PIN 输入框 `fontSize` 改为 `titleLg` = 22px，更易输入

---

### 6. 写日记 `app/memory/create.tsx`

**设计状态：优秀**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 顶部取消/发表 | ✅ | 文字按钮 + hitSlop |
| 标题 | ✅ | `title` = 17px |
| 日期 | ⚠️ | `micro` = 11px，偏小 |
| 草稿栏 | ✅ | 有存草稿、草稿箱 |
| 正文输入 | ✅ | `postBody` = 18px，reading 字体 |
| 设置行 | ✅ | 60px 高，44pt+ |
| 弹层 | ✅ | 统一 sheet 样式 |
| 保存反馈 | ✅ | Toast + 动画 |

**问题：**
1. `date` 用 `micro` = 11px，在移动端偏小（违反 `readable-font-size`）
2. 草稿栏操作 `minHeight: 34`，不满足 44pt
3. PostComposer 中 `toolPill` `minHeight: 36`，不满足触控标准
4. `removeAttachment` 按钮 22×22，远低于 44pt（虽然有 `hitSlop={8}` 扩展到 38×38，仍不足）
5. 设置行 `settingIcon` 36×36 的图标容器偏小
6. 自动保存 2 秒延迟期间无视觉反馈
7. 录音功能在 Web 端体验不完整

**优化建议：**
- `date` 改为 `caption` = 13px
- 草稿栏操作 `minHeight` 改为 44
- `toolPill` `minHeight` 改为 44
- `removeAttachment` 增大 `hitSlop` 到 `{ top: 12, bottom: 12, left: 12, right: 12 }`
- 自动保存时显示 "已自动保存" 微提示

---

### 7. 日记详情 `app/memory/[id].tsx`

**设计状态：良好**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 返回按钮 | ✅ | 44×44 |
| 编辑/删除 | ✅ | 44×44 |
| 作者名 | ✅ | `title` = 17px |
| 日期 | ✅ | `caption` = 13px |
| 正文 | ✅ | WritingPreview 组件 |
| 语音播放 | ✅ | 播放/暂停 + 进度条 |
| 图片网格 | ✅ | 响应式尺寸 |
| 大图查看 | ✅ | Modal + 左右切换 |
| 标签 | ✅ | pill 样式 |
| 私密标记 | ✅ | pill + 图标 |

**问题：**
1. `voiceButton` 30×30，不满足 44pt 触控标准
2. `tagPill` `minHeight: 30`，不满足触控标准（但标签不一定可点击）
3. `personChip` padding 很小，整体可能不足 44pt
4. 图片 `mediaThumb` 尺寸通过计算得出（76-128px），但点击区域等于图片大小
5. 大图查看器的导航按钮 56×56 ✅
6. 大图查看器关闭按钮在 `top: spacing.xxxl` = 32px，可能被状态栏遮挡

**优化建议：**
- `voiceButton` 增大到至少 44×44，或加 `hitSlop`
- `personChip` 增加 `minHeight: 44` 和 `paddingVertical`
- 大图查看器关闭按钮 `top` 改为 `spacing.giant` + `safeAreaInsetTop`

---

### 8. 搜索 `app/search.tsx`

**设计状态：良好**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 搜索框 | ✅ | 48px 高 |
| 清除按钮 | ✅ | hitSlop 10 |
| 取消按钮 | ✅ | hitSlop 12 |
| 分区标题 | ✅ | `caption` = 13px |
| 人物结果 | ✅ | SectionCard |
| 空状态 | ✅ | 有文案 |

**问题：**
1. 搜索结果用 `ScrollView` + `.map()`，无虚拟化
2. 搜索只搜人物和记忆标题/内容，不搜标签、心情、社区帖子
3. 无搜索历史或建议
4. `personMeta` 缺少 `fontFamily`

**优化建议：**
- 结果列表改用 `FlatList`
- 扩大搜索范围到标签、心情
- 增加搜索历史记录

---

### 9. 日历 `app/calendar.tsx`

**设计状态：良好**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 返回按钮 | ✅ | 44×44 |
| 标题 | ✅ | `titleLg` = 22px |
| 月份切换 | ✅ | 44×44 |
| 月份选择器 | ✅ | Modal + 滚轮 |
| 星期标签 | ✅ | `caption` = 13px |
| 日期格 | ✅ | `minHeight: 52` |
| 记忆点 | ✅ | 6×6 圆点 |
| 空状态 | ✅ | 有文案 |

**问题：**
1. 日历网格 `dayCell` `width: ${100/7}%`，在 375px 屏幕上每格约 53px，日期文字 `body` = 16px 可能偏大
2. 滚轮选择器 `ITEM_HEIGHT = 44`，`pickerItem` 高度 44px ✅
3. 日期格可点击但 `dayCell` 没有设置 `accessibilityState` 的 `selected`（实际有设置 ✅）
4. 日历下方记忆列表用 `.map()`，无虚拟化

**优化建议：**
- 日期文字可考虑用 `caption` = 13px 让网格更紧凑
- 记忆列表改用 `FlatList`

---

### 10. 新增人物 `app/person/create.tsx`

**设计状态：良好**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 取消按钮 | ✅ | hitSlop 12 |
| 标题 | ✅ | `display` = 28px |
| 头像上传 | ✅ | 88px 头像 |
| 名字输入 | ✅ | `body` = 16px |
| 关系选择 | ⚠️ | `relationPill` 无 `minHeight` |
| 备注输入 | ✅ | multiline |
| 保存按钮 | ✅ | PrimaryButton 54px |

**问题：**
1. `relationPill` 没有设置 `minHeight`，`paddingVertical: spacing.sm` = 8px + 文字行高 ≈ 35px，不满足 44pt
2. `relationPill` 没有 `borderWidth`，与卡通贴纸风格不一致（其他 chip 都有描边）
3. `relationPillActive` 用 `alpha.accent10`（10% 透明度橙色），选中态不够明显
4. 输入框用 `borderBottomWidth: 1` 发丝线，与整体粗描边风格冲突
5. `label`、`helper` 缺少 `fontFamily`

**优化建议：**
- `relationPill` 加 `minHeight: 44` + `borderWidth: strokeWidth.input` + `borderColor: colors.stroke`
- 选中态改用 `colors.accent` 实底 + 白字
- 输入框改为完整边框 `borderRadius: radius.input` + `borderWidth: strokeWidth.input`

---

### 11. 人物详情 `app/person/[id].tsx`

**设计状态：良好**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 返回/编辑/删除 | ✅ | 44×44 |
| 头像 | ✅ | 64px |
| 名字 | ✅ | `titleLg` = 22px |
| 备注 | ✅ | `body` = 16px |
| 统计 | ✅ | `caption` = 13px |
| 写日记按钮 | ✅ | PrimaryButton |
| 筛选 tab | ✅ | 40px 高 |
| 年份 | ✅ | `caption` |
| 记忆列表 | ✅ | MemoryCard |

**问题：**
1. `tabChip` `height: 40` 不满足 44pt
2. 记忆列表用 `.map()`，无虚拟化

**优化建议：**
- `tabChip` `height` 改为 44
- 记忆列表改用 `FlatList`

---

### 12. 私密设置 `app/settings/privacy.tsx`

**设计状态：良好**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 返回按钮 | ✅ | 44×44 |
| 标题 | ✅ | `titleLg` = 22px |
| 统计卡 | ✅ | 三列统计 |
| 批量操作 | ✅ | PrimaryButton + 次级按钮 |
| 单条操作 | ⚠️ | `itemButton` `minHeight: 40` |
| 取消私密 | ⚠️ | `unlockButton` `minHeight: 40` |
| 警告 | ✅ | 有图标+文案 |

**问题：**
1. `itemButton` 和 `unlockButton` `minHeight: 40` 不满足 44pt
2. 多处缺少 `fontFamily`：`subtitle`、`statLabel`、`warningText`、`memoryMeta`、`modeText`、`itemButtonText`、`unlockText`、`empty`
3. `back` 按钮没有 `borderWidth`，与其他页面的图标按钮不一致

**优化建议：**
- 所有操作按钮 `minHeight` 改为 44
- 补充 `fontFamily`
- `back` 按钮加 `borderWidth: strokeWidth.button` + `borderColor: colors.stroke`

---

### 13. 备份恢复 `app/settings/backup.tsx`

**设计状态：良好**

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 返回按钮 | ⚠️ | 无描边 |
| 标题 | ✅ | `titleLg` = 22px |
| 统计卡 | ✅ | 四列统计 |
| 导出按钮 | ✅ | PrimaryButton |
| 恢复按钮 | ✅ | 52px 高 |
| 导入预览 | ✅ | 网格 + 冲突列表 |
| 操作按钮 | ✅ | 多个操作 |
| 说明 | ✅ | 有图标+文案 |

**问题：**
1. `back` 按钮没有描边（与 `privacy.tsx` 同一问题）
2. 多处缺少 `fontFamily`：`subtitle`、`statLabel`、`estimateDesc`、`estimateSubtle`、`noteText`、`message`、`previewLabel`、`previewNote`、`conflictText`、`cancelImportText`
3. `replaceButton` `borderWidth: 1` 与其他按钮的 `strokeWidth.input` = 2 不一致
4. `cancelImportButton` 没有 `minHeight`，可能不满足 44pt

**优化建议：**
- 补充描边和 `fontFamily`
- `replaceButton` `borderWidth` 改为 `strokeWidth.input`
- `cancelImportButton` 加 `minHeight: 44`

---

## 三、字体大小手机端适配分析

### 当前字体 Token

| Token | 大小 | 行高 | 用途 | 移动端评估 |
|-------|------|------|------|-----------|
| `display` | 28px | 36px | 页面主标题 | ✅ 合适 |
| `titleLg` | 22px | 30px | 次级标题 | ✅ 合适 |
| `title` | 17px | 24px | 卡片标题、设置项 | ✅ 合适 |
| `metricLg` | 30px | 36px | 大数字指标 | ✅ 合适 |
| `postBody` | 18px | 34px | 日记正文 | ✅ 合适，阅读舒适 |
| `body` | 16px | 27px | 正文 | ✅ 符合最低标准 |
| `caption` | 13px | 19px | 辅助文字、标签 | ⚠️ 375px 屏上偏小 |
| `micro` | 11px | 16px | 元信息、时间戳 | ❌ 低于 12px 建议下限 |

### 字体问题清单

1. **`micro` = 11px** 在以下位置使用，移动端可读性差：
   - `create.tsx` 的日期标签
   - `community.tsx` 的收藏按钮文字
   - `MemoryCard` 的 `withCount`、`targetText`、`metaDot`、`privateText`、`mood`
   - `PersonSheet` 的 `authorFootnoteMeta`
   - `me.tsx` 的模态日期
   - `privacy.tsx` 的 `modeText`

2. **`caption` = 13px** 在 375px 屏幕上多处使用密集：
   - 时间线筛选 chip 文字
   - 社区话题 chip 文字
   - 星图人物标签
   - 各种 meta 信息

3. **行高问题**：`body` 行高 27px（1.69:1）✅，`caption` 行高 19px（1.46:1）略低于 1.5 建议

### 字体优化建议

```
micro:  11px → 12px（提升可读性下限）
caption: 13px → 14px（在 375px 屏上更清晰）
body:   16px → 保持（符合标准）
行高统一：caption 19px → 20px（达到 1.43 → 保持略低但可接受）
```

---

## 四、触控目标不达标清单

| 页面 | 元素 | 当前尺寸 | 标准要求 | 严重程度 |
|------|------|----------|----------|----------|
| timeline | 筛选 chip | 42px | 44px | 低 |
| community | 话题 chip | 40px | 44px | 中 |
| community | 收藏按钮 | 32px | 44px | **高** |
| community | 操作行 | 36px | 44px | **高** |
| create | 草稿栏操作 | 34px | 44px | 中 |
| create | toolPill | 36px | 44px | 中 |
| create | removeAttachment | 22px (hitSlop 8→38) | 44px | **高** |
| memory detail | voiceButton | 30px | 44px | **高** |
| person create | relationPill | ~35px | 44px | 中 |
| person detail | tabChip | 40px | 44px | 低 |
| privacy | itemButton | 40px | 44px | 低 |
| privacy | unlockButton | 40px | 44px | 低 |

**总计：12 处触控目标不达标，4 处为高严重度。**

---

## 五、功能完整性评估

### ✅ 已完成功能

| 功能 | 状态 | 质量 |
|------|------|------|
| 写日记（文字/照片/录音/位置/心情/标签/私密） | ✅ | 优秀 |
| 编辑日记 | ✅ | 良好 |
| 删除日记 | ✅ | 有确认 |
| 草稿自动保存 | ✅ | 2 秒延迟 |
| 草稿箱（多篇归档） | ✅ | 有恢复/删除 |
| 人物 CRUD | ✅ | 完整 |
| 星图关系可视化 | ✅ | 有动画 |
| 时间线（筛选/排序） | ✅ | 多维筛选 |
| 日历视图 | ✅ | 有记忆标记 |
| 搜索 | ✅ | 人物+记忆 |
| 应用锁（PIN） | ✅ | 有模态 |
| 私密记忆管理 | ✅ | 批量+单条 |
| 备份导出 | ✅ | 含媒体 |
| 备份恢复 | ✅ | 合并/覆盖/替换 |
| 社区发布 | ✅ | 从日记发布 |
| 社区点赞/收藏 | ✅ | 会话级 |
| 暗色模式 | ✅ | Web 端跟随系统 |

### ⚠️ 功能不完整

| 功能 | 当前状态 | 缺失内容 |
|------|----------|----------|
| 社区评论 | 跳转日记详情 | 无独立评论系统 |
| 社区通知 | 显示空状态 | 无真实互动数据 |
| 社区"附近" | 基于本地日记位置 | 无位置权限引导 |
| 社区"热门" | 简单排序 | 无时间窗口/权重算法 |
| 社交身份 | 所有帖子作者都是"我" | 无用户系统/多用户 |
| 关注系统 | 会话级状态 | 不持久化 |
| 搜索 | 人物+记忆 | 不搜标签/社区/全文 |
| 录音播放 | 详情页可播放 | 写作时不能试听/删除 |
| 云同步 | 无 | 端到端加密未实现 |
| AI 辅助 | 无 | 无总结/提取/建议 |
| 分享导出 | 无 | 无图片分享/文本导出 |

### ❌ 缺失功能

| 功能 | 重要性 | 说明 |
|------|--------|------|
| 评论系统 | P1 | 社区核心闭环缺失 |
| 标签系统 | P1 | 已实现写作+筛选，但搜索不覆盖 |
| 分享图片 | P1 | 日记分享到外部应用 |
| 搜索历史 | P2 | 提升搜索体验 |
| 通知中心 | P2 | 社区互动通知 |
| 用户头像自定义 | P2 | "我"页面无头像设置 |
| 数据统计 | P2 | 写作频率/心情趋势 |
| 导出文本 | P2 | 轻量导出能力 |
| 地图视图 | P3 | 按位置回看日记 |

---

## 六、漫画风格一致性审查

### 风格一致性评分

| 维度 | 评分 | 问题 |
|------|------|------|
| 描边一致性 | 7/10 | person/create 输入框用 1px 发丝线，不符合 2.5px 粗描边 |
| 圆角一致性 | 9/10 | 统一 18-20px 圆角 |
| 阴影一致性 | 8/10 | 贴纸投影统一，但部分页面缺少 |
| 色彩一致性 | 8/10 | 暖色系统一，缺少辅助强调色 |
| 字体一致性 | 6/10 | 多处缺少 fontFamily 声明 |
| 图标一致性 | 9/10 | 统一使用 lucide-react-native |
| 交互反馈 | 8/10 | 大部分有 pressed/scale，少数缺失 |

### 风格偏离清单

1. `person/create.tsx` 输入框：`borderBottomWidth: 1` + `borderBottomColor: colors.divider`
   - **应为**：完整边框 + `strokeWidth.input` + `colors.stroke` + `radius.input`

2. `person/create.tsx` 关系选择 pill：无边框、无描边
   - **应为**：`borderWidth: strokeWidth.input` + `borderColor: colors.stroke`

3. `person/create.tsx` 选中态：`alpha.accent10`（10% 透明）
   - **应为**：`colors.accent` 实底 + 深色文字

4. `privacy.tsx` 和 `backup.tsx` 返回按钮：无描边
   - **应为**：`borderWidth: strokeWidth.button` + `borderColor: colors.stroke`

5. `backup.tsx` `replaceButton`：`borderWidth: 1`
   - **应为**：`strokeWidth.input` = 2

6. 多处 `fontFamily` 缺失，回退到默认 sans 而非 display 字体

---

## 七、优化优先级排序

### P0：必须修复（影响可用性和可访问性）

1. **修复 4 处高严重度触控目标**
   - `community.tsx` 收藏按钮 32→44
   - `community.tsx` 操作行 36→44
   - `create.tsx` removeAttachment 22→44（含 hitSlop）
   - `memory/[id].tsx` voiceButton 30→44

2. **修复筛选 chip 选中态对比度**
   - `timeline.tsx`、`community.tsx`、`person/[id].tsx` 的选中态白字改为深色字

3. **提升 `micro` 字号**
   - `tokens.ts` `micro: 11` → `12`

### P1：应该修复（影响体验和一致性）

4. **补充缺失的 `fontFamily`**
   - 全项目搜索缺少 `fontFamily` 的 `Text` 样式，统一补充

5. **修复 `person/create.tsx` 风格偏离**
   - 输入框改为完整边框
   - 关系 pill 加描边和选中态

6. **修复返回按钮风格不一致**
   - `privacy.tsx`、`backup.tsx` 返回按钮加描边

7. **列表虚拟化**
   - `timeline.tsx`、`community.tsx`、`people.tsx`、`search.tsx` 改用 `FlatList`

8. **修复 8 处中低严重度触控目标**
   - 所有 `minHeight: 40` 的按钮改为 44

### P2：建议优化（提升品质）

9. **补充辅助强调色**
   - 在橙色系外增加一个辅助色（如墨绿 `#5B8C5A` 或靛蓝 `#5B6CB0`）
   - 用于区分功能区域（如社区 vs 日记）

10. **社区功能补全**
    - 评论系统
    - 通知中心
    - 搜索扩展

11. **星图可访问性**
    - 补充 `accessibilityRole` 和 `accessibilityLabel`

12. **Native 端暗色模式动态切换**
    - 当前 `colorScheme` 在启动时固定，不跟随系统变化

13. **写作体验增强**
    - 录音试听和删除
    - 自动保存视觉反馈
    - 分享图片生成

### P3：长期规划

14. 云同步（端到端加密）
15. AI 辅助功能
16. 数据统计与可视化
17. 地图视图
18. 用户系统与多设备

---

## 八、暗色模式专项检查

### 对比度验证

| 元素 | 浅色模式 | 暗色模式 | 评估 |
|------|----------|----------|------|
| textPrimary on bgPrimary | #3D2E22 on #FFF8EE | #FFF3E4 on #211912 | ✅ 两端均 > 7:1 |
| textSecondary on bgPrimary | #7A6553 on #FFF8EE | #E4CBB4 on #211912 | ✅ 两端均 > 4.5:1 |
| textTertiary on bgPrimary | #A89484 on #FFF8EE | #B99B82 on #211912 | ⚠️ 浅色 ≈ 3.2:1，暗色 ≈ 4.8:1 |
| accent on bgPaper | #E89B5B on #FFFFFF | #F2B06F on #35271D | ⚠️ 浅色 ≈ 2.8:1，暗色 ≈ 4.2:1 |
| bgPaper on accent (选中态) | #FFFFFF on #E89B5B | #35271D on #F2B06F | ❌ 浅色 ≈ 2.3:1 |

**关键问题：**
- `textTertiary` 在浅色模式下对比度 3.2:1，不满足 WCAG AA 4.5:1（用于辅助文字，至少需要 3:1，刚好达标但偏低）
- `accent` 色作为文字色在白色背景上对比度不足
- 选中态白字在 accent 背景上对比度严重不足

**建议：**
- `textTertiary` 浅色模式从 `#A89484` 加深到 `#8A7565`（对比度 ≈ 4.5:1）
- 选中态文字从白色改为 `textPrimary` 深棕色

### Native 端暗色模式问题

```typescript
// tokens.ts 第 194 行
export const colorScheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
```

**问题**：`colorScheme` 在模块加载时固定，用户在系统设置中切换深色模式后，App 不会跟随变化。

**建议**：使用 `useColorScheme()` Hook 或监听 `Appearance.addChangeListener`。

---

## 九、性能检查

### 列表虚拟化

| 页面 | 当前渲染方式 | 数据量预期 | 需要虚拟化 |
|------|-------------|-----------|-----------|
| timeline | ScrollView + map | 100+ 条记忆 | ✅ 是 |
| community | ScrollView + map | 50+ 条帖子 | ✅ 是 |
| people | ScrollView + map | 20+ 人 | ⚠️ 可选 |
| search | ScrollView + map | 不定 | ✅ 是 |
| calendar | ScrollView + map | 月内条数 | ❌ 否 |
| memory detail | ScrollView | 单条 | ❌ 否 |

### 其他性能问题

1. **StarMap `FloatingNode`** 每个节点有独立的 `Animated.loop`，10+ 人物时可能有性能影响
2. **MemoryCard** 的 `useWindowDimensions` 在每个卡片实例中调用，可提升到父级
3. **社区帖子** 的 `Animated.Value` 在组件内创建，帖子多时内存压力大

---

## 十、交付检查清单

基于 `ui-ux-pro-max` Pre-Delivery Checklist：

### 视觉质量
- [x] 不使用 emoji 作为图标（统一使用 lucide-react-native）
- [x] 图标来自统一图标库
- [x] 描边视觉不导致布局跳动
- [ ] 语义主题 token 100% 覆盖（多处缺少 fontFamily）
- [ ] 所有描边粗细一致（person/create 输入框偏离）

### 交互
- [x] 所有可点击元素有 pressed 反馈
- [ ] 所有触控目标 ≥ 44pt（12 处不达标）
- [x] 微交互动效 150-300ms（motion tokens 符合）
- [x] 禁用状态有视觉降权
- [x] 无障碍标签完整
- [x] 手势区域无冲突

### 明暗模式
- [ ] 主文本对比度 ≥ 4.5:1 两端（textTertiary 浅色模式偏低）
- [x] 辅助文本对比度 ≥ 3:1 两端
- [ ] 分割线/边框在两端可见
- [x] 模态遮罩足够（40-60% 黑）
- [ ] 两端均已测试（Native 端不跟随系统切换）

### 布局
- [x] 安全区已尊重（SafeAreaView）
- [x] 滚动内容不被固定栏遮挡
- [ ] 375px 宽度验证（部分页面触控目标过小）
- [x] 4/8dp 间距节奏（spacing token 符合）
- [x] 长文本在大屏可读

### 可访问性
- [x] 所有有意义的图标有无障碍标签
- [x] 表单字段有标签
- [x] 颜色不是唯一指示器
- [x] 支持减少动态效果
- [ ] 支持 Dynamic Type / 系统字体缩放（未实现）

---

## 总结

记得日记在漫画风格（Claymorphism）的执行上已经相当成熟，暖棕色调、粗描边、圆角贴纸感形成了独特的视觉语言。写作体验是核心亮点，PostComposer 的设置行式渐进展示设计优秀。

**最需要优先解决的 3 个问题：**
1. 触控目标不达标（12 处，4 处高严重度）
2. 选中态文字对比度不足（白字 on 橙色 ≈ 2.3:1）
3. 字号 `micro` = 11px 在移动端偏小

**最需要优先补全的功能：**
1. 社区评论系统（闭环核心）
2. 搜索范围扩展（标签/全文）
3. 分享图片导出
