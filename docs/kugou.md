# 酷狗补完计划

日期：2026-11-17

让酷狗账号在 SPlayer-Next 里达到与网易云同等的产品完整度。

前置问题：项目原有唯一的登录态 `user.profile / user.isLoggedIn` 只由网易云写入，酷狗登录只写 `dataStore.platformProfiles`，导致任何依赖账号态的功能在酷狗下恒为空。本计划首先解决这个结构问题。

## 平台登录态

- 新增 `system.onlinePlatform: Platform`，默认 `netease`，持久化于主进程配置
- `stores/data.ts` 提供 `activePlatform()`、`isActivePlatformLoggedIn`
- 账号来源按平台分流：netease 读 `user.profile`，其余读 `platformProfiles`
- `LoginDialog.vue` 顶部提供平台切换，登录后按平台收尾，底部可切换当前平台
- `NavUser.vue` 的登录态、头像、昵称、登出均按当前平台处理
- 平台切换时清空共享展示容器，避免串数据

## 每日推荐

- `modules/everyday_recommend.ts`，走 `x-router: everydayrec.service.kugou.com`
- 该接口返回扁平结构（`ori_audio_name` / `sizable_cover` / `time_length`），与 `normalizeKGSong` 的嵌套资源结构不同，单独归一化
- `stores/data.ts` 的 `ensureDailyRecommend` 按平台分派
- 归档缓存 key 为 `daily-recommend-archive:{platform}:{userId}`
- `/daily` 页闸门改为 `data.isActivePlatformLoggedIn`

## 首页推荐

- `modules/special_recommend.ts`（`/v2/special_recommend`），body 键序参与 android 签名
- `useHomeDiscover` 增加平台维度：酷狗只拉推荐歌单，雷达/歌手/新碟留空
- 缓存增加 `platform` 字段，切换平台失效

## 用户中心

- `modules/user_playlist.ts`（`/v7/get_all_list`）、`modules/user_history.ts`（`/playhistory/v1/get_songs`）
- `modules/artist_follow.ts`：参数经通用 AES 加密（md5 前 32 位作 aes-256 密钥），随机密钥再经 RSA 包装
- `stores/user.ts` 新增 `loadKugouContent` / `clearSharedContent` / `setKugouFollow`
- 酷狗数据写入共享展示容器，切换平台时清空

## 听歌上报

- `modules/playhistory.ts`（`/playhistory/v1/upload_songs`），只在结算时提交一次
- `services/kugouScrobble.ts` 复用 `createPlayProgress`，与网易云打卡同构但独立
- 接入 `ipc/player.ts` 的 8 个播放事件点与 `playerControl.ts`
- 开关 `system.kugouScrobbleEnabled`，默认关闭

## 云盘

- `modules/user_cloud.ts`：列表、删除、播放地址
- 云盘域名 `mcloudservice.kugou.com` 不参与通用签名，`p` 参数由 RSA 包装 AES 密钥，正文为 AES 密文（aes-128-cbc，base64）
- 云盘曲目以 `comment = "kugou-cloud"` 标记，音源解析据此走 `user_cloud_url`
- `pages/Cloud.vue` 的列表来源标识按当前平台决定

## fork 身份

`appId: top.sijin.splayer-kugou`、`productName: SPlayer-Kugou`、`nsis.guid` 同步修改、更新器指向 `sijin-xb/SPlayer-Next`、`updaterCacheDirName: splayer-kugou-updater`。

不改会被安装器当成同一产品覆盖，且 fork 会拉取上游 release。

## 非目标

- 酷狗云盘上传（`user_cloud_upload` 涉及分片与曲库匹配，未实现）
- 酷狗歌手榜、新碟、雷达歌单
- MV、电台、KTV、直播、听歌房、青春频道
- 网易云既有链路的行为变更

## 验证

| 项           | 命令                                                          | 结果                                |
| ------------ | ------------------------------------------------------------- | ----------------------------------- |
| 类型         | `pnpm typecheck`                                              | 通过                                |
| Lint         | `pnpm lint`                                                   | 通过                                |
| 前端测试     | `pnpm test:web`                                               | 75 文件 / 599 用例通过              |
| 主进程测试   | `pnpm test:node`                                              | 53 用例通过                         |
| 平台分派单测 | `npx vitest run src/stores/data.spec.ts`                      | 5/5 通过                            |
| AES 封装单测 | `npx vitest run electron/main/apis/kugou/core/crypto.spec.ts` | 4/4 通过                            |
| 启动         | `pnpm dev`                                                    | Electron 启动，三个原生模块加载成功 |

未验证：酷狗账号的实际扫码登录，以及全部新增接口的真实响应。需要真实账号。

## 已知风险

- 各接口的响应结构依据 `KuGouMusicApi` 与 `MoeKoeMusic` 的消费方式推断，字段名可能存在个别差异
- `special_recommend` 的 body 键序要求来自 `kugou-tui` 的实现注释，未在本仓库独立验证
- 云盘 `del_song` 的接口路径与参数未经实际调用确认
- 关注歌手依赖通用 AES 与 RSA 的组合，密钥生成方式按上游实现复刻，未实测
