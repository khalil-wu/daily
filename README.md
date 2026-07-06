# 记得日记

基于 Expo 57、Expo Router、TypeScript 构建的 React Native App 原型工程。

## 当前已完成

- 四个 Tab 主导航：首页星图、身边人、时间线、我的
- 人物新增、编辑、删除
- 记忆新增、详情、编辑、删除
- 记忆可关联多人、记录心情、添加照片
- 本地数据持久化：Web 使用 `localStorage`，原生端使用 `expo-sqlite`
- 照片持久化：Web 保存为 data URI，原生端复制到应用文档目录
- 搜索页：支持按人物、关系、备注、记忆标题和正文检索
- 总时间线支持年份、人物、心情、照片、私密复合筛选；人物详情支持“全部 / 照片”筛选
- 本地备份与恢复：导出 / 导入 JSON 备份，导出前显示体积预估，导入前可预览、查看重复项，并选择跳过重复项、覆盖重复项或整体替换；原生端会把本地照片内容内嵌进备份并在导入时恢复
- 应用锁：本地 PIN 锁定，支持设备系统验证
- 私密记忆：可在创建 / 编辑时标记为“完全隐藏”或“隐藏正文”，未解锁时会按模式保护内容
- 私密记忆管理页：集中查看私密记忆，批量调整隐藏方式，或逐条取消私密

## 技术选型

- Expo 57
- Expo Router
- TypeScript
- Zustand
- lucide-react-native
- react-native-svg
- expo-sqlite
- expo-file-system
- expo-image-picker
- expo-document-picker
- expo-sharing
- expo-crypto
- expo-local-authentication

## 运行方式

```bash
npm install
npm run web
```

开发服务通常会启动在 `http://localhost:8081`，如果端口被占用，Expo 会自动换到下一个可用端口。

## 验证方式

```bash
npm test
npm run typecheck
```

当前自动化测试覆盖备份解析与合并、私密记忆可见性与遮罩模式、数据归一化、备份体积估算，以及人物 / 记忆 CRUD 与隐私模式切换的状态更新。

## 目录说明

- `app/`: 路由层
- `src/components/`: 组件层
- `src/theme/`: 设计 token
- `src/data/`: 演示数据
- `src/stores/`: 本地状态
- `src/storage/`: 本地数据、媒体、设置存储
- `src/backup/`: 备份格式与导入导出服务
- `src/i18n/`: 文案
- `tests/`: 核心数据逻辑测试

## 下一阶段建议

1. 为 SQLite 仓储补更多测试。
2. 增加导入冲突逐项处理，让重复人物和记忆可以逐条选择覆盖或保留。
3. 做一轮真机验证，重点检查照片、SQLite、分享和系统验证。
4. 给大体积照片备份增加压缩或分包策略。
5. 增加私密记忆批量搜索和筛选。
