import type { KGModule } from "../core/types";
import type { KGPlaylistItem } from "@shared/types/platform/kugou";
import { getSessionCookies } from "@main/database/sessions";
import { kgGatewayRequest } from "../core/request";
import { decodeName, fillCover } from "../core/config";

interface KGUserList {
  listid?: number | string;
  global_collection_id?: string;
  name?: string;
  listname?: string;
  intro?: string;
  pic?: string;
  img?: string;
  list_create_username?: string;
  nickname?: string;
  count?: number | string;
  is_def?: number;
  [key: string]: unknown;
}

interface KGUserListResponse {
  data?: {
    info?: KGUserList[];
    count?: number;
  };
}

/**
 * 用户歌单列表（自建 + 收藏）
 * @param params - page / pageSize 分页
 * @returns 歌单列表与总数
 */
const userPlaylist: KGModule = async (params) => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) throw new Error("KG 未登录，无法获取用户歌单");

  const page = String(params.page ?? 1);
  const pageSize = String(params.pageSize ?? 30);

  const response = await kgGatewayRequest<KGUserListResponse>("/v7/get_all_list", {
    method: "POST",
    headers: { "x-router": "cloudlist.service.kugou.com" },
    params: { plat: 1, userid: Number(session.userid), token: session.token },
    data: {
      userid: session.userid,
      token: session.token,
      total_ver: 979,
      type: 2,
      page,
      pagesize: pageSize,
    },
  });

  const info = response.data?.info ?? [];
  const playlists: KGPlaylistItem[] = info
    .map((raw) => ({
      id: String(raw.listid ?? ""),
      name: decodeName(raw.name ?? raw.listname ?? ""),
      cover: fillCover(raw.pic ?? raw.img, 300),
      creator: decodeName(raw.list_create_username ?? raw.nickname ?? ""),
      trackCount: Number(raw.count ?? 0),
      playCount: 0,
      description: decodeName(raw.intro ?? ""),
      isLiked: raw.is_def === 2,
      system: Boolean(raw.is_def),
      collected: raw.source === 2,
    }))
    .filter((item) => item.id && item.name);

  return { code: 200, playlists, total: response.data?.count ?? playlists.length };
};

export default userPlaylist;
