import type { KGModule } from "../core/types";
import type { KGSong, Quality } from "@shared/types/platform/kugou";
import { getSessionCookies } from "@main/database/sessions";
import { kgGatewayRequest } from "../core/request";
import { decodeName, fillCover } from "../core/config";

/** 用户歌单曲目，比公开歌单多一个 fileid */
interface KGUserSongRaw {
  fileid?: number;
  hash?: string;
  audio_id?: number;
  mixsongid?: number;
  filename?: string;
  songname?: string;
  ori_audio_name?: string;
  singername?: string;
  album_name?: string;
  album_id?: string | number;
  duration?: number;
  timelen?: number;
  album_audio_id?: number;
  cover?: string;
  [key: string]: unknown;
}

interface KGUserSongResponse {
  data?: { songs?: KGUserSongRaw[]; count?: number };
}

/**
 * 把用户歌单曲目转成统一结构
 * @param raw - 原始条目
 * @returns 含 fileId 的歌曲
 */
const toSong = (raw: KGUserSongRaw): KGSong => {
  const hash = String(raw.hash ?? "");
  const duration = Number(raw.timelen ?? raw.duration ?? 0);
  const hashes: Partial<Record<Quality, string>> = hash ? { "128k": hash } : {};
  const artist = decodeName(raw.singername ?? "");
  return {
    id: String(raw.audio_id || hash),
    audioId: Number(raw.audio_id ?? 0),
    albumAudioId: Number(raw.album_audio_id ?? raw.mixsongid ?? 0),
    fileId: Number(raw.fileid ?? 0),
    hash,
    name: decodeName(raw.ori_audio_name ?? raw.songname ?? raw.filename ?? ""),
    artist,
    artists: artist ? [{ id: artist, name: artist }] : [],
    album: decodeName(raw.album_name ?? ""),
    albumId: raw.album_id != null ? String(raw.album_id) : "",
    cover: fillCover(raw.cover, 300),
    coverOriginal: fillCover(raw.cover, 480),
    interval: duration,
    duration: duration * 1000,
    qualities: Object.keys(hashes) as Quality[],
    hashes,
    sizes: {},
    pay: { payplay: 0, privilege: 0 },
  };
};

/**
 * 用户歌单内的曲目
 * 与公开歌单接口不同，这条路径会返回删除所需的 fileid
 * @param params - listid 歌单 id，page / pageSize 分页
 * @returns 曲目列表与总数
 */
const userPlaylistTracks: KGModule = async (params) => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) throw new Error("KG 未登录，无法读取歌单");
  const listid = String(params.listid ?? params.id ?? "");
  if (!listid) throw new Error("KG 歌单曲目缺少 listid");

  const page = String(params.page ?? 1);
  const pageSize = String(params.pageSize ?? 300);

  const response = await kgGatewayRequest<KGUserSongResponse>("/v4/get_list_all_file", {
    method: "POST",
    headers: { "x-router": "cloudlist.service.kugou.com" },
    data: {
      listid,
      userid: session.userid,
      area_code: 1,
      show_relate_goods: 0,
      pagesize: pageSize,
      allplatform: 1,
      show_cover: 1,
      type: 0,
      token: session.token,
      page,
    },
  });

  const list = response.data?.songs ?? [];
  const songs = list.map(toSong).filter((song) => Boolean(song.hash));
  return { code: 200, songs, total: response.data?.count ?? songs.length };
};

export default userPlaylistTracks;
