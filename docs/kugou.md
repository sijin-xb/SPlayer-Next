# 酷狗补完计划

日期：2026-11-17

让酷狗账号在 SPlayer-Next 里达到与网易云同等的产品完整度。

前置问题：项目原有唯一的登录态 `user.profile / user.isLoggedIn` 只由网易云写入，酷狗登录只写 `dataStore.platformProfiles`，导致任何依赖账号态的功能在酷狗下恒为空。本计划首先解决这个结构问题。

## 登录版本

`system.kugouLoginVersion` 取 `concept`（默认）或 `standard`，切换后清空酷狗会话，需重新扫码。

两套参数不通用：

| 版本   | appid | clientver | 签名盐                             |
| ------ | ----- | --------- | ---------------------------------- |
| 概念版 | 3116  | 11440     | `LnT6xpN3khm36zse0QzvmgTZ3waWdRSA` |
| 标准版 | 1005  | 20489     | `OIlwieks28dk2k092lksi2UIkp`       |

token 与登录时使用的 appid 绑定。标准版 token 调概念版接口返回 `error_code: 20018`，无法通过接口互换，只能重新扫码。

`/v5/url` 另用固定 `clientver: 11430` 与 signKey 盐 `185672dd44712f60bb1736df5a377e82`（概念版）/ `57ae12eb6890223e355ccfcb74edf70d`（标准版）。

区别体现在 url 参数上：

- 概念版：`ap3116`、`pi411`、`pa967177915`、`ppage_id=356753938`、`mx0`
- 标准版：`ap1005`、`pi2`、`pa151369488`、`ppage_id=463467626,350369493,788954147`、`mx<audio_id>`

概念版必须传 `album_audio_id=0`。传歌单里的 `audio_id` 会被降级成 30 秒试听。

## 平台登录态

- `system.onlinePlatform: Platform`，默认 `netease`，持久化于主进程配置
- `stores/data.ts` 提供 `activePlatform` computed、`isActivePlatformLoggedIn`
- 账号来源按平台分流：netease 读 `user.profile`，其余读 `platformProfiles`
- `LoginDialog.vue` 顶部提供平台切换，登录后按平台收尾，底部可切换当前平台
- `NavUser.vue` 的登录态、头像、昵称、登出均按当前平台处理
- 平台切换时清空共享展示容器，避免串数据

## 归一化

酷狗三类接口返回三种形状，统一由 `core/song.ts` 处理：

| 入口                                   | 形状                                  | 归一化函数                                  |
| -------------------------------------- | ------------------------------------- | ------------------------------------------- |
| `/v4/get_list_all_file_v3`、历史、搜索 | 扁平，音质在 `relate_goods[]`         | `normalizeFlatSong`                         |
| `/playhistory/v1/get_songs`            | 外层 `{mxid, ot, ...}` 内嵌 `info`    | 取 `item.info` 后 `normalizeFlatSong`       |
| `/everyday_song_recommend`             | 扁平，音质在 `hash_128/320/flac/high` | `normalizeFlatSong(raw, { seconds: true })` |

`relate_goods` 在歌单/历史中是数组，在每日推荐中是对象，两种都要处理。

`mixsongid` 即上报用的 `mxid`，写入 `Track.extId`。`fileid` 写入 `Track.mediaId`，歌单删除依赖它。

## 用户中心

- `modules/user_playlist.ts`（`/v7/get_all_list`）：歌单 id 用 `listid` 数字，不用 `global_collection_id`；「我喜欢」由 `is_def === 2` 标识
- `modules/user_playlist_tracks.ts`（`/v4/get_list_all_file_v3`，x-router `cloudlist.service.kugou.com`）：曲目在 `data.info`，每页上限 300
- `modules/user_history.ts`（`/playhistory/v1/get_songs`）
- `modules/artist_follow.ts`：参数经通用 AES 加密（md5 前 32 位作 aes-256 密钥），随机密钥再经 RSA 包装
- `stores/user.ts` 新增 `loadKugouContent` / `clearSharedContent` / `setKugouFollow`
- 酷狗数据写入共享展示容器，切换平台时清空

## 收藏

「我喜欢」在酷狗就是一个普通歌单（`listid=2`），红心等价于向该歌单增删曲目：

- 加：`modules/playlist_edit.ts` 的 `playlistAddSongs`（`/cloudlist.service/v6/add_song`）
- 删：`playlistDeleteSongs`（`/v4/delete_songs`），参数是歌单内 `fileid`

`useFavorite` 的 `isLiked` / `isSupported` / `toggle` 已覆盖 `kugou` 来源。

### 关注歌手

- `modules/artist_follow.ts`：`/followservice/v3/follow_singer` 与 `unfollow_singer`，参数 AES 加密 + RSA 包装
- 歌手页关注按钮已按平台接通；已关注状态本地跟踪（酷狗无已关注列表接口），按账号持久化在 cacheDb

### 歌单收藏（未完成）

- 用户歌单用 `/v7/get_all_list` 的 `source` 区分：`1` 自建（含默认收藏/我喜欢）、`2` 收藏，写入 `Playlist.collected`，store 的自建/收藏列表按此分桶
- 收藏路由按当前平台拼装（`/collection/:source/...`），此前硬编码 netease 导致酷狗歌单 404
- 取消收藏端点已实现：`playlistUnsubscribe`（`/v2/delete_list`，规格对齐 kugou-tui KAT：AES 密文 body + RSA 包装 p + `x-router`）
- 收藏端点未通：上游 `playlist_add.js` 的 `/cloudlist.service/v5/add_list` 带 `type=1` 实测恒 `20010`（type=0 新建可用），需抓包确认 collect-from-special 的真实参数；收藏按钮对酷狗保持隐藏
- 专辑收藏端点未定位，按钮对酷狗隐藏

## 听歌上报

- `modules/playhistory.ts`（`/playhistory/v1/upload_songs`），只在结算时提交一次
- `services/kugouScrobble.ts` 复用 `createPlayProgress`，与网易云打卡同构但独立
- 接入 `ipc/player.ts` 的 8 个播放事件点与 `playerControl.ts`
- 开关 `system.kugouScrobbleEnabled`，默认关闭

## 云盘

- `modules/user_cloud.ts`：列表、删除、播放地址
- 云盘域名 `mcloudservice.kugou.com` 不参与通用签名，`p` 参数由 RSA 包装 AES 密钥，正文为 AES 密文（aes-128-cbc，base64）
- 列表 `/v1/get_list`、删除 `/v1/del_files`（body `{data:[{kv_id,album_audio_id}]}`，`kv_id` 来自列表条目）
- 播放地址走 `gateway.kugou.com/bsstrackercdngz/v2/query_musicclound_url`，`key` 是云盘专用 `md5("musicclound"+hash+pid+"ebd1ac…e2e7")`，且必须带 `token` 与 `signature`
- 云盘曲目以 `comment = "kugou-cloud"` 标记，音源解析据此走 `user_cloud_url`
- `pages/Cloud.vue` 的列表来源标识按当前平台决定
- 上传见 `services/kugouCloudUpload.ts`

## fork 身份

`appId: top.sijin.splayer-kugou`、`productName: SPlayer-Kugou`、`nsis.guid` 同步修改、更新器指向 `sijin-xb/SPlayer-Next`、`updaterCacheDirName: splayer-kugou-updater`。

不改会被安装器当成同一产品覆盖，且 fork 会拉取上游 release。

## 非目标

- 酷狗歌手榜、新碟、雷达歌单
- MV、电台、KTV、直播、听歌房、青春频道
- 网易云既有链路的行为变更

## 验证

| 项           | 命令                                                          | 结果                   |
| ------------ | ------------------------------------------------------------- | ---------------------- |
| 类型         | `pnpm typecheck`                                              | 通过                   |
| Lint         | `npx eslint <改动文件>`                                       | 通过                   |
| 前端测试     | `pnpm test:web`                                               | 75 文件 / 599 用例通过 |
| 主进程测试   | `pnpm test:node`                                              | 53 用例通过            |
| 平台分派单测 | `npx vitest run src/stores/data.spec.ts`                      | 5/5 通过               |
| AES 封装单测 | `npx vitest run electron/main/apis/kugou/core/crypto.spec.ts` | 4/4 通过               |

真实账号（概念版，VIP）实测：

| 项         | 结果                                                                               |
| ---------- | ---------------------------------------------------------------------------------- |
| 用户歌单   | 3 个，`listid` 1/2/3，「我喜欢」430 首                                             |
| 歌单曲目   | 分页 300/页，`relate_goods` 四档齐全                                               |
| 每日推荐   | 30 首                                                                              |
| 付费曲取流 | 完整 320k，`/yp/full/`，`isTrial:false`                                            |
| 红心增删   | 430 → 431 → 430                                                                    |
| 听歌上报   | 上报后曲目出现在 `/playhistory/v1/get_songs`                                       |
| 用户资料   | `isVip:true`（`busi_vip` 中 `concept/tvip` 有效，`svip` 无效）                     |
| 播放       | 日志「加载成功」，URL 含 `ap3116`、`pi411`、`qu320`、`mx0`                         |
| 云盘       | 五步分片上传后列表出现新曲目，取流与删除均成功                                     |
| 关注歌手   | `/followservice/v3/follow_singer` 与 unfollow 均返回 200                           |
| 关注按钮   | 歌手页收藏/取关按钮闭环：状态 false → true → false                                 |
| 曲库匹配   | 命中时 `data` 为 `[[条目]]`，hash 在 `audio_info.hash`；未命中 `data:[{}]`         |
| 收藏歌单   | 「我的收藏」仅列 source=2 条目，点击打开 `/collection/kugou/playlist/:id` 正常加载 |

秒传匹配的解析以曲库 hash 与本地文件 md5 一致为准；`hash` 字段在条目的 `audio_info` 内，顶层没有 `hash`。

未验证：`/v2/get_res_privilege/lite` 返回的 `high` 档（账号非超级 VIP）；秒传完整命中链路（需与曲库逐字节相同的文件）；酷狗歌单收藏（`/cloudlist.service/v5/add_list` type=1 恒 20010，待抓包）。

## 已知风险

- `special_recommend` 的 body 键序参数字段来自 `kugou-tui` 的实现注释，本仓库实测可返回 40 条，键序改动未验证
