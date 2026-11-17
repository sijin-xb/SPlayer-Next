import type { KGModule } from "../core/types";
import type { KGSong } from "@shared/types/platform/kugou";
import { getSessionCookies } from "@main/database/sessions";
import { kgGatewayRequest } from "../core/request";
import { normalizeKGSong } from "../core/song";

interface KGHistoryItem {
  audio_info?: { hash?: string; audio_id?: number };
  base?: { audio_id?: number; audio_name?: string; author_name?: string };
  [key: string]: unknown;
}

interface KGHistoryResponse {
  data?: { info?: KGHistoryItem[]; songs?: KGHistoryItem[] };
  songs?: KGHistoryItem[];
}

/**
 * 用户听歌排行
 * @param params - page / pageSize 分页
 * @returns 归一化后的曲目
 */
const userHistory: KGModule = async (params) => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) throw new Error("KG 未登录，无法获取听歌排行");

  const response = await kgGatewayRequest<KGHistoryResponse>("/playhistory/v1/get_songs", {
    method: "POST",
    data: {
      token: session.token,
      userid: session.userid,
      source_classify: "app",
      to_subdivide_sr: 1,
      page: params.page ?? 1,
      pagesize: params.pageSize ?? 50,
    },
  });

  const list = response.data?.info ?? response.data?.songs ?? response.songs ?? [];
  // 无 hash 的条目无法解析播放地址，直接丢弃
  const songs: KGSong[] = list
    .map((item) => normalizeKGSong(item as never))
    .filter((song) => Boolean(song.hash));

  return { code: 200, songs };
};

export default userHistory;
