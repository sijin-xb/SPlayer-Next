# 酷狗补完计划 — 一期：平台登录态与每日推荐

日期：2026-11-17

## 目标

让酷狗账号在 SPlayer-Next 里可用账号态功能（每日推荐、首页推荐），并为后续三期打地基。

前置问题：项目原有唯一的登录态 `user.profile / user.isLoggedIn` 只由网易云写入，酷狗登录只写 `dataStore.platformProfiles`，导致任何依赖账号态的功能在酷狗下恒为空。一期首先解决这个结构问题。

## 范围

### 平台登录态抽象

- 新增 `system.onlinePlatform: Platform`，默认 `netease`，持久化于主进程配置
- `stores/data.ts` 新增 `activePlatform()`、`isActivePlatformLoggedIn`、`dailyAccount(platform)`
- 账号来源按平台分流：netease 读 `user.profile`，其余读 `platformProfiles`

### 登录入口

- `LoginDialog.vue` 支持平台切换（NCM / QM / KG），默认选中当前 `activePlatform`
- 登录成功后按平台收尾：netease 走 `user.fetchStatus()`，其余走 `platformProfiles`
- 底部提供「使用 X 作为当前平台」

### 每日推荐

- 主进程新增 `modules/everyday_recommend.ts`，走 `x-router: everydayrec.service.kugou.com`
- 该接口返回扁平结构（`ori_audio_name` / `sizable_cover` / `time_length`），与 `normalizeKGSong` 的嵌套资源结构不同，故在本模块内单独归一化
- `stores/data.ts` 的 `ensureDailyRecommend` 按平台分派
- 归档缓存 key 改为 `daily-recommend-archive:{platform}:{userId}`，平台与账号间互不覆盖
- `/daily` 页闸门由 `user.isLoggedIn` 改为 `data.isActivePlatformLoggedIn`

### 首页推荐

- 主进程新增 `modules/special_recommend.ts`（`/v2/special_recommend`），body 键序参与 android 签名，必须与上游报文一致
- `useHomeDiscover` 增加平台维度：酷狗只拉推荐歌单，雷达/歌手/新碟留空，不做跨平台混排
- 缓存增加 `platform` 字段，切换平台失效

### 顶部账号区

- `NavUser.vue` 的登录态与展示资料按 `activePlatform` 取
- 登出按平台分流
- 收藏计数与等级展示仍限网易云（其余平台的收藏功能未实现）

## 非目标

- 用户中心（收藏歌单、关注、听歌排行）——二期
- 听歌上报——三期
- 云盘——四期
- 网易云既有链路的行为变更

## 验证

| 项           | 命令                                     | 结果                                |
| ------------ | ---------------------------------------- | ----------------------------------- |
| 类型         | `pnpm typecheck`                         | 通过                                |
| Lint         | `pnpm lint`                              | 通过                                |
| 前端测试     | `pnpm test:web`                          | 74 文件 / 595 用例通过              |
| 主进程测试   | `pnpm test:node`                         | 53 用例通过                         |
| 平台分派单测 | `npx vitest run src/stores/data.spec.ts` | 5/5 通过                            |
| 启动         | `pnpm dev`                               | Electron 启动，三个原生模块加载成功 |

未验证：酷狗账号的实际扫码登录与每日推荐接口的真实响应。需要真实账号，无法在本环境完成。

## 已知风险

- `everyday_song_recommend` 的响应结构依据 `MoeKoeMusic` 的消费方式推断（`data.song_list`），字段名可能存在个别差异
- `special_recommend` 的 body 键序要求来自 `kugou-tui` 的实现注释，未在本仓库独立验证
