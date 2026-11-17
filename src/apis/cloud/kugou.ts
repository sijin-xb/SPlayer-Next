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
    id: String(raw.audio_id ?? hash),
    audioId: Number(raw.audio_id ?? 0),
    albumAudioId: Number(raw.album_audio_id ?? 0),
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
  const response = await kugouCall<CloudListResponse>("user_cloud", { page: 1, pageSize: 100 });
  const songs = (response?.songs ?? []).map(toSong);
  // comment 作为云盘来源标记，播放地址走 query_musicclound_url 而非 song_url
  return kgSongsToTracks(songs).map((track) => ({ ...track, comment: KUGOU_CLOUD_MARK }));
};

/**
 * 删除酷狗云盘歌曲
 * @param hashes - 曲目 hash 列表
 */
export const deleteKugouCloudTracks = async (hashes: string[]): Promise<void> => {
  await kugouCall("user_cloud_del", { hashes });
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
