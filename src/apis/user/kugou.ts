import type { Playlist, Track } from "@shared/types/player";
import type { KGPlaylistItem, KGSong } from "@shared/types/platform/kugou";
import { kugouCall } from "@/apis/kugou";
import { kgSongsToTracks } from "@/utils/format/kugou";

interface KGUserPlaylistResponse {
  code?: number;
  playlists?: KGPlaylistItem[];
  total?: number;
}

interface KGUserHistoryResponse {
  code?: number;
  songs?: KGSong[];
}

/**
 * 把酷狗歌单条目转成统一 Playlist
 * @param item - 酷狗歌单
 * @returns 统一歌单对象
 */
const toPlaylist = (item: KGPlaylistItem): Playlist => ({
  id: item.id,
  name: item.name,
  cover: item.cover,
  owner: item.creator,
  trackCount: item.trackCount,
  isLiked: item.isLiked === true,
});

/**
 * 酷狗用户歌单
 * @returns 自建与收藏的歌单
 */
export const fetchKugouUserPlaylists = async (): Promise<Playlist[]> => {
  const response = await kugouCall<KGUserPlaylistResponse>("user_playlist", {
    page: 1,
    pageSize: 100,
  });
  return (response?.playlists ?? []).map(toPlaylist);
};

/**
 * 酷狗听歌排行
 * @returns 最近播放曲目
 */
export const fetchKugouUserHistory = async (): Promise<Track[]> => {
  const response = await kugouCall<KGUserHistoryResponse>("user_history", {
    page: 1,
    pageSize: 50,
  });
  return kgSongsToTracks(response?.songs);
};

/**
 * 关注或取关酷狗歌手
 * @param singerId - 歌手 id
 * @param follow - true 关注，false 取关
 */
export const setKugouArtistFollow = async (singerId: string, follow: boolean): Promise<void> => {
  await kugouCall("artist_follow", {
    singerid: Number(singerId),
    action: follow ? "add" : "del",
  });
};
