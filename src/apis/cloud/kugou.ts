import type { Track } from "@shared/types/player";
import type { KGSong } from "@shared/types/platform/kugou";
import { kugouCall } from "@/apis/kugou";
import { kgSongsToTracks } from "@/utils/format/kugou";

interface CloudListResponse {
  code?: number;
  songs?: Array<Record<string, unknown>>;
  total?: number;
}

interface CloudUrlResponse {
  code?: number;
  url?: string;
}

/** 云盘曲目标记，播放解析据此切换接口 */
export const KUGOU_CLOUD_MARK = "kugou-cloud";

/**
 * 把云盘原始条目转成 KGSong
 * @param raw - 云盘条目
 * @returns 统一歌曲结构
 */
const toSong = (raw: Record<string, unknown>): KGSong => {
  const duration = Number(raw.timelen ?? raw.duration ?? 0);
  const hash = String(raw.hash ?? "");
  return {
    id: hash || String(raw.audio_id ?? ""),
    audioId: Number(raw.audio_id ?? 0),
    albumAudioId: Number(raw.album_audio_id ?? 0),
    fileId: Number(raw.kv_id ?? 0),
    hash,
    name: String(raw.ori_name ?? raw.name ?? raw.filename ?? ""),
    artist: String(raw.author_name ?? raw.singername ?? ""),
    artists: [],
    album: String(raw.album_name ?? raw.albumname ?? ""),
    albumId: String(raw.album_id ?? ""),
    cover: typeof raw.cover === "string" ? raw.cover : undefined,
    interval: duration,
    duration,
    qualities: [],
    hashes: hash ? { "128k": hash } : {},
    sizes: {},
    pay: { payplay: 0, privilege: 0 },
  };
};

/**
 * 酷狗云盘歌曲
 * @returns 云盘曲目
 */
export const fetchKugouCloudTracks = async (): Promise<Track[]> => {
  const raw: Array<Record<string, unknown>> = [];
  let page = 1;
  let total = Infinity;
  while (raw.length < total) {
    const response = await kugouCall<CloudListResponse>("user_cloud", { page, pageSize: 100 });
    const list = response?.songs ?? [];
    raw.push(...list);
    total = response?.total ?? raw.length;
    if (list.length < 100) break;
    page += 1;
  }
  const songs = raw.map(toSong);
  // comment 作为云盘来源标记，播放地址走 query_musicclound_url 而非 song_url
  return kgSongsToTracks(songs).map((track) => ({ ...track, comment: KUGOU_CLOUD_MARK }));
};

/**
 * 删除酷狗云盘歌曲，定位依赖云盘列表的 kv_id
 * @param tracks - 云盘曲目
 */
export const deleteKugouCloudTracks = async (tracks: Track[]): Promise<void> => {
  const items = tracks.map((track) => ({
    kvId: Number(track.mediaId ?? 0),
    albumAudioId: Number(track.extId ?? 0),
  }));
  await kugouCall("user_cloud_del", { items });
};

/**
 * 解析酷狗云盘播放地址
 * @param track - 云盘曲目
 * @returns 播放地址，失败返回 null
 */
export const resolveKugouCloudUrl = async (track: Track): Promise<string | null> => {
  try {
    const response = await kugouCall<CloudUrlResponse>("user_cloud_url", {
      hash: track.id,
      audioId: track.extId,
      name: track.title,
    });
    return response?.url ?? null;
  } catch {
    return null;
  }
};
