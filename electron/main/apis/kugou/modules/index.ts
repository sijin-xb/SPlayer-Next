/**
 * KG 模块注册表
 */

import type { KGModule } from "../core/types";

import lyric from "./lyric";
import search from "./search";
import album from "./album";
import artist from "./artist";
import playlist from "./playlist";
import userDetail from "./user_detail";
import { loginQrCheck, loginQrKey } from "./login_qr";
import songUrl from "./song_url";
import comment from "./comment";
import everydayRecommend from "./everyday_recommend";
import specialRecommend from "./special_recommend";
import userPlaylist from "./user_playlist";
import userHistory from "./user_history";
import artistFollow from "./artist_follow";
import playhistoryUpload from "./playhistory";
import { cloudDelete, cloudList, cloudUrl } from "./user_cloud";

export const modules: Record<string, KGModule> = {
  lyric,
  search,
  album,
  artist,
  playlist,
  song_list: playlist,
  user_detail: userDetail,
  login_qr_key: loginQrKey,
  login_qr_check: loginQrCheck,
  song_url: songUrl,
  comment,
  everyday_recommend: everydayRecommend,
  special_recommend: specialRecommend,
  user_playlist: userPlaylist,
  user_history: userHistory,
  artist_follow: artistFollow,
  playhistory_upload: playhistoryUpload,
  user_cloud: cloudList,
  user_cloud_del: cloudDelete,
  user_cloud_url: cloudUrl,
};
