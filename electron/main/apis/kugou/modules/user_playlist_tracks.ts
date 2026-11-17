import type { KGModule } from "../core/types";
import type { KGSong } from "@shared/types/platform/kugou";
import { getSessionCookies } from "@main/database/sessions";
import { kgGatewayRequest } from "../core/request";
import { normalizeFlatSong, type KGFlatSong } from "../core/song";

interface KGUserSongsResponse {
  data?: { info?: KGFlatSong[]; count?: number };
}

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

  const response = await kgGatewayRequest<KGUserSongsResponse>("/v4/get_list_all_file_v3", {
    method: "POST",
    headers: { "x-router": "cloudlist.service.kugou.com" },
    params: { plat: 1, userid: Number(session.userid), token: session.token },
    data: {
      listid,
      userid: session.userid,
      type: 0,
      page: String(params.page ?? 1),
      pagesize: String(params.pageSize ?? 300),
      area_code: 1,
      allplatform: 1,
      show_cover: 1,
      show_relate_goods: 1,
      token: session.token,
    },
  });

  const songs: KGSong[] = (response.data?.info ?? [])
    .map((raw) => normalizeFlatSong(raw))
    .filter((song) => Boolean(song.hash));

  return { code: 200, songs, total: response.data?.count ?? songs.length };
};

export default userPlaylistTracks;
