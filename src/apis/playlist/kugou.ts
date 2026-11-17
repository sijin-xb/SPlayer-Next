import type { KGSong } from "@shared/types/platform/kugou";
import type { Playlist, Track } from "@shared/types/player";
import { kugou as kgApi, kugouCall } from "@/apis/kugou";
import { useUserStore } from "@/stores/user";
import { kgSongsToTracks } from "@/utils/format/kugou";

interface KGPlaylistDetailResponse {
  code?: number;
  message?: string;
  id?: string | number;
  name?: string;
  description?: string;
  creator?: string;
  cover?: string;
  coverOriginal?: string;
  playCount?: number;
  total?: number;
  songs?: KGSong[];
}

interface KGUserPlaylistTracksResponse {
  code?: number;
  songs?: KGSong[];
  total?: number;
}

/**
 * 获取 KG 歌单详情与歌曲列表
 * 当前用户自己的歌单走 file 接口以取得 fileid，其余走公开歌单接口
 * @param id - 歌单 ID (specialid)
 * @param fallbackName - 兜底名称
 * @returns 歌单元数据与 Track 列表
 */
export const fetchKugouPlaylist = async (
  id: string,
  fallbackName: string,
): Promise<{ playlist: Playlist; tracks: Track[] }> => {
  const user = useUserStore();
  const own = user.playlists.find((item) => String(item.id) === String(id));

  if (own) {
    const response = await kugouCall<KGUserPlaylistTracksResponse>("user_playlist_tracks", {
      listid: id,
      page: 1,
      pageSize: 300,
    });
    const tracks = kgSongsToTracks(response.songs);
    return {
      playlist: {
        id: String(own.id ?? id),
        name: own.name || fallbackName,
        cover: own.cover ?? tracks[0]?.cover,
        owner: own.owner,
        trackCount: own.trackCount ?? response.total ?? tracks.length,
      },
      tracks,
    };
  }

  const body = await kgApi.playlist<KGPlaylistDetailResponse>({ id });
  if (body.code !== 200) throw new Error(body.message || `KG 歌单请求失败: ${body.code}`);

  const tracks = kgSongsToTracks(body.songs);

  return {
    playlist: {
      id: String(body.id ?? id),
      name: body.name || fallbackName,
      cover: body.cover || tracks[0]?.cover,
      description: body.description,
      owner: body.creator,
      trackCount: body.total ?? tracks.length,
    },
    tracks,
  };
};
