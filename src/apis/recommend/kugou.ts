import type { Track } from "@shared/types/player";
import type { CoverItem } from "@/types/artist";
import type { KGPlaylistItem, KGSong } from "@shared/types/platform/kugou";
import { kugouCall } from "@/apis/kugou";
import { kgPlaylistToCoverItem, kgSongsToTracks } from "@/utils/format/kugou";

interface KugouRecommendResponse {
  code?: number;
  songs?: KGSong[];
}

interface KugouSpecialResponse {
  code?: number;
  playlists?: KGPlaylistItem[];
}

/**
 * 酷狗每日推荐歌曲，需登录
 * @returns 推荐曲目
 */
export const fetchKugouDailySongs = async (): Promise<Track[]> => {
  const response = await kugouCall<KugouRecommendResponse>("everyday_recommend", {});
  return kgSongsToTracks(response?.songs);
};

/**
 * 酷狗广场推荐歌单
 * @returns 歌单封面卡片
 */
export const fetchKugouRecommendPlaylists = async (): Promise<CoverItem[]> => {
  const response = await kugouCall<KugouSpecialResponse>("special_recommend", {
    categoryId: 0,
    page: 1,
    pageSize: 12,
  });
  return (response?.playlists ?? []).map(kgPlaylistToCoverItem);
};
