# 架构设计文档

## 当前技术栈

- Expo SDK 57
- React 19
- React Native 0.86
- React Native Web
- expo-router
- Zustand
- TypeScript
- lucide-react-native
- react-native-svg
- Node test runner + tsx

## 目录职责

### `app/`

负责路由页面和页面级组合。

- `(tabs)/`：底部 Tab 页面，包括首页、时间线、人物、社区、我的。
- `memory/`：日记创建、详情、编辑。
- `person/`：人物创建、详情、编辑。
- `settings/`：隐私、备份等设置页面。
- `search.tsx`：搜索入口。

页面层应该尽量只处理：路由、页面状态、组合组件、调用 store action。复杂业务逻辑不要继续堆在页面里。

### `src/components/`

负责可复用组件。

- `memory/`：日记卡片、写作组件。
- `person/`：头像、人物弹层。
- `privacy/`：应用锁入口。
- `stargraph/`：关系星图布局和渲染。
- `ui/`：通用按钮、卡片、屏幕容器。

组件层不应直接承担复杂持久化逻辑。组件可以接收回调，但不应知道数据如何保存。

### `src/stores/`

负责应用状态和业务 action。

- `useDiaryStore`：人物、日记、社区内容。
- `useAppLockStore`：应用锁状态。
- `useDraftStore`：写作草稿状态。

所有会影响持久化的数据变化都应通过 store action 完成，并补测试。

### `src/storage/`

负责平台差异存储。

- Web 和 Native 分文件实现。
- repository 对上层暴露稳定接口。
- 页面和组件不能直接访问底层存储 API。

### `src/backup/`

负责备份数据估算、解析、规范化、合并。

备份逻辑必须保持纯函数优先，方便测试和未来迁移。

### `src/privacy/`

负责私密内容可见性计算。

页面不应自己判断哪些内容隐藏，而应通过统一 selector 或 hook 获取可见数据。

### `src/theme/`

负责设计 token。

- `tokens.ts`：颜色、字体、间距、圆角、阴影。
- `layout.ts`：响应式宽度和列宽。
- `applyTypography.ts`：全局字体应用。

新增 UI 风格必须先落到 token，再应用到页面。

### `src/motion/`

负责动画 token、触感反馈、减少动态效果。

所有新增动画应使用这里的 token 和 hook，不在页面里随意写常量。

## 当前数据流

1. 页面从 store 或 hook 读取数据。
2. 用户点击按钮或输入内容。
3. 页面调用 store action。
4. store 更新内存状态。
5. store 调用 repository 持久化。
6. 页面自动响应状态变化。

隐私数据流额外经过 `useVisibleDiaryData`，页面拿到的是经过过滤或脱敏后的数据。

## 推荐演进方向

### 抽离日记编辑逻辑

`app/memory/create.tsx` 和 `app/memory/[id]/edit.tsx` 有大量重复逻辑，包括照片、拍摄、录音、位置、人物、心情、排版、私密模式。建议新增：

- `src/hooks/useMemoryEditor.ts`
- `src/components/memory/MemoryEditorSheet.tsx`
- `src/components/memory/MemoryEditorHeader.tsx`

页面只负责传入初始值和保存回调。

### 社区状态进入 store

当前点赞、关注、转发偏页面会话状态。后续应迁移到 `useDiaryStore`。

建议新增 action：

- `toggleCommunityLike(postId)`
- `toggleCommunityRepost(postId)`
- `toggleCommunityFollow(authorId)`
- `addCommunityComment(postId, content)`
- `deleteCommunityComment(commentId)`

### 统一交互扫描

将当前手动 Pressable 扫描升级为脚本，例如：

- `scripts/audit-interactions.ts`

检查内容：

- `Pressable` 是否有 `onPress` 或 `disabled`。
- 图标按钮是否有 `accessibilityLabel`。
- `PrimaryButton` 是否有 label 和明确 disabled。

### 类型优先

新增功能顺序固定为：

1. 定义或扩展类型。
2. 更新 normalize / backup / repository。
3. 更新 store action。
4. 更新页面 UI。
5. 增加测试。

不要先在页面里拼临时字段。

## 测试策略

### 必跑检查

- `npm test`
- `npm run typecheck`
- Web export 前运行 Pressable 扫描。

### Store 测试

以下功能必须有 store 级测试：

- 新增、编辑、删除人物。
- 新增、编辑、删除日记。
- 私密模式切换。
- 社区发布和取消发布。
- 未来的点赞、关注、转发、评论。
- 备份合并、覆盖、替换。

### UI 手工验收

- 375px 手机宽度。
- 768px 平板宽度。
- 桌面 Web 宽度。
- 减少动态效果开启。
- 新用户空数据状态。
- 有大量日记和人物的数据状态。

## 部署架构

当前部署为静态 Web 产物：

1. `npx expo export --platform web --output-dir dist --clear`
2. 打包 `dist`。
3. 上传服务器 release 目录。
4. 更新 `/var/www/remember-diary/system` 和 `/var/www/remember-diary/test` symlink。
5. `nginx -t && systemctl reload nginx`。

系统环境和测试环境当前可以指向同一 release。未来如果需要灰度，二者应指向不同 release。

## 架构约束

- 不允许页面直接操作底层存储。
- 不允许新增 UI 风格绕过 theme token。
- 不允许社区功能只做静态假按钮。
- 不允许破坏本地优先记录能力。
- 不允许云同步功能在没有隐私设计的情况下上线。
- 不允许删除用户未确认的数据。
