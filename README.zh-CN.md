<div align="center">

<img alt="SPlayer-Kugou" width="120" height="120" src="public/icons/favicon.png" />

<h2>SPlayer-Kugou</h2>

<p>基于 SPlayer-Next 的桌面音乐播放器分支，接入酷狗音乐。</p>

[![License](https://img.shields.io/github/license/sijin-xb/splayer-kugou)](https://github.com/sijin-xb/splayer-kugou/blob/dev/LICENSE)

[English](./README.md) | **简体中文**

</div>

---

## 这是什么

SPlayer-Kugou 是 [SPlayer-Next](https://github.com/SPlayer-Dev/SPlayer-Next) 的下游分支。在原有的本地播放、歌词与流媒体服务器能力之上，补齐了酷狗音乐的账号、曲库与云盘链路。

与上游的差异集中在 `electron/main/apis/kugou/`、`src/apis/*/kugou.ts` 与平台分派层，其余代码跟随上游 `dev` 分支。

## 下载

安装包发布在 [Releases](https://github.com/sijin-xb/splayer-kugou/releases)：

| 平台    | 格式                               |
| ------- | ---------------------------------- |
| Windows | 安装版（含自动更新）、单文件便携版 |
| macOS   | dmg                                |
| Linux   | AppImage、deb、rpm、pacman、tar.gz |

Linux 产物名为 `splayer-kugou-<版本>-<架构>.<扩展名>`，可执行文件为 `SPlayer-Kugou`。

> 更新器与下载页指向 `sijin-xb/splayer-kugou`。GitHub 仓库需先完成改名并发布 release，否则检查更新会失败。

## 酷狗支持

登录入口：**设置 → 其他设置 → 平台登录**，或在登录弹窗顶部切换到 KG。

| 能力                                  | 状态               |
| ------------------------------------- | ------------------ |
| 扫码登录、Cookie 登录，标准版与概念版 | 可用               |
| 搜索单曲、专辑、歌手、歌单            | 可用               |
| 歌曲取流，高音质无权益时自动降档      | 可用               |
| 每日推荐、推荐歌单                    | 可用               |
| 用户歌单、我喜欢（红心增删）          | 可用               |
| 歌手关注与取关                        | 可用               |
| 播放历史、听歌历史上报                | 可用，上报默认关闭 |
| 云盘列表、上传、秒传匹配、删除、取流  | 可用               |
| 歌曲评论                              | 可用，仅热门       |
| 歌单收藏、专辑收藏                    | 未接通，按钮隐藏   |

登录版本在 **设置 → 其他设置 → 平台配置** 中切换。标准版与概念版的凭据不通用，切换后需重新扫码。

## 已知限制

- 歌单收藏与专辑收藏的接口未接通，酷狗下不显示收藏按钮。
- 首页推荐只取推荐歌单，雷达、歌手、新碟区块为空。
- `high` 音质档与云盘秒传完整命中链路未用真实账号验证。
- 酷狗评论只提供热门分类。
- 未实现歌手榜、新碟、MV、电台、KTV、直播等模块。

## 从源码构建

需要 Node.js >= 24、pnpm >= 12 与 Rust 工具链。

```bash
pnpm install
pnpm dev          # 开发模式，先以 debug 构建原生模块
pnpm build        # 完整构建：清理 → 原生模块 → 类型检查 → electron-vite
pnpm build:linux  # 打包，另有 build:win / build:mac
```

只改前端时可设 `SKIP_NATIVE_BUILD=true` 跳过 Rust 编译。

原生模块位于 `native/`，共 7 个 crate：`audio-engine`、`audio-capture`、`media-ctrl`、`taskbar-lyric`、`taskbar-thumbnail`、`opencc`、`automix-worker`。

校验命令：`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm test:native`。

## 许可

沿用上游的 [AGPL-3.0](LICENSE) 许可。原作者与版权信息见 [SPlayer-Next](https://github.com/SPlayer-Dev/SPlayer-Next)。

修改与分发需同样以 AGPL-3.0 提供完整源码，并保留原始版权声明。
