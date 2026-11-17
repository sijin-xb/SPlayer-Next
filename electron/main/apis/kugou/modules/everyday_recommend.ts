import type { KGModule } from "../core/types";
import type { KGSong, Quality } from "@shared/types/platform/kugou";
import { getSessionCookies } from "@main/database/sessions";
import { kgGatewayRequest } from "../core/request";
import { decodeName, fillCover } from "../core/config";

interface KGRecommendSong {
  hash?: string;
  audio_id?: number;
  album_audio_id?: number;
  album_id?: string | number;
  ori_audio_name?: string;
  audio_name?: string;
  songname?: string;
  author_name?: string;
  singername?: string;
  album_name?: string;
  albumname?: string;
  time_length?: number;
  timelength?: number;
  sizable_cover?: string;
  img?: string;
  privilege?: number;
  pay_type?: number;
}

interface KGRecommendResponse {
  data?: { song_list?: KGRecommendSong[] };
  song_list?: KGRecommendSong[];
}

/**
 * 把每日推荐的扁平曲目转成统一的 KGSong
 * 该接口只返回 128k 地址，其余音质在播放时按 hash 再解析
 * @param raw - 接口原始曲目
 * @returns 时长为毫秒的歌曲
 */
const normalizeRecommendSong = (raw: KGRecommendSong): KGSong => {
  const hash = raw.hash ?? "";
  const artist = decodeName(raw.author_name ?? raw.singername ?? "");
  const duration = raw.time_length ?? raw.timelength ?? 0;
  const hashes: Partial<Record<Quality, string>> = hash ? { "128k": hash } : {};
  const coverTpl = raw.sizable_cover ?? raw.img;

  return {
    id: String(raw.audio_id || hash),
    audioId: raw.audio_id ?? 0,
    albumAudioId: raw.album_audio_id,
    hash,
    name: decodeName(raw.ori_audio_name ?? raw.audio_name ?? raw.songname ?? ""),
    artist,
    artists: artist ? [{ id: artist, name: artist }] : [],
    album: decodeName(raw.album_name ?? raw.albumname ?? ""),
    albumId: raw.album_id != null ? String(raw.album_id) : "",
    cover: fillCover(coverTpl, 300),
    coverOriginal: fillCover(coverTpl, 480),
    interval: duration,
    duration: duration * 1000,
    qualities: Object.keys(hashes) as Quality[],
    hashes,
    sizes: {},
    pay: {
      payplay: raw.pay_type ?? 0,
      privilege: raw.privilege ?? 0,
    },
  };
};

/**
 * 官方每日推荐
 * 未登录时接口返回公共推荐，此处直接拒绝，避免账号态功能被匿名数据污染
 * @returns 归一化后的推荐曲目
 */
const everydayRecommend: KGModule = async () => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) throw new Error("KG 未登录，无法获取每日推荐");

  const response = await kgGatewayRequest<KGRecommendResponse>("/everyday_song_recommend", {
    method: "POST",
    headers: { "x-router": "everydayrec.service.kugou.com" },
    data: {
      platform: "android",
      userid: session.userid,
    },
  });

  const rawList = response.data?.song_list ?? response.song_list ?? [];
  const songs = rawList.filter((item) => item.hash).map(normalizeRecommendSong);

  if (songs.length === 0) throw new Error("KG 每日推荐返回空列表");
  return { code: 200, songs };
};

export default everydayRecommend;
