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

/** 歌单接口单页上限，超过需翻页 */
const USER_TRACKS_PAGE_SIZE = 300;

/**
 * 分页拉取自有歌单全部曲目
 * 接口按 sort 降序返回（sort 越大加入越早），倒序后与客户端一致：最新加入在前，专辑歌单则回归曲序
 * @param listid - 酷狗歌单 id（数字 listid）
 * @returns 该歌单全部 Track
 */
export const fetchOwnPlaylistTracks = async (listid: string): Promise<Track[]> => {
  const collected: KGSong[] = [];
  for (let page = 1; ; page++) {
    const response = await kugouCall<KGUserPlaylistTracksResponse>("user_playlist_tracks", {
      listid,
      page,
      pageSize: USER_TRACKS_PAGE_SIZE,
    });
    const songs = response.songs ?? [];
    collected.push(...songs);
    const total = Number(response.total ?? 0);
    if (songs.length < USER_TRACKS_PAGE_SIZE || (total > 0 && collected.length >= total)) break;
  }
  return kgSongsToTracks(collected.reverse());
};

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
  // 歌单列表未加载时无法区分自建与公开歌单，按自建试读，空结果再回退公开接口
  const ownTracks =
    own || user.playlists.length === 0 ? await fetchOwnPlaylistTracks(id).catch(() => []) : [];
  if (own || ownTracks.length > 0) {
    return {
      playlist: {
        id: String(own?.id ?? id),
        name: own?.name || fallbackName,
        cover: own?.cover ?? ownTracks[0]?.cover,
        description: own?.description,
        owner: own?.owner,
        trackCount: own?.trackCount ?? ownTracks.length,
      },
      tracks: ownTracks,
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
