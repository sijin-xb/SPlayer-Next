import type { KGModule } from "../core/types";
import type { KGSong } from "@shared/types/platform/kugou";
import { getSessionCookies } from "@main/database/sessions";
import { kgGatewayRequest } from "../core/request";
import { normalizeFlatSong, type KGFlatSong } from "../core/song";

interface KGRecommendResponse {
  data?: { song_list?: KGFlatSong[] };
}

/**
 * 官方每日推荐
 * 未登录时接口返回公共推荐，此处直接拒绝，避免账号态功能被匿名数据污染
 * @returns 归一化后的推荐曲目
 */
const everydayRecommend: KGModule = async () => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) throw new Error("KG 未登录，无法获取每日推荐");

  // x-router 决定落到推荐服务，缺失时官方返回空 song_list
  const response = await kgGatewayRequest<KGRecommendResponse>("/everyday_song_recommend", {
    method: "POST",
    headers: { "x-router": "everydayrec.service.kugou.com" },
    data: {
      platform: "android",
      userid: session.userid,
    },
  });

  const songs: KGSong[] = (response.data?.song_list ?? [])
    .filter((item) => item.hash)
    .map((raw) => normalizeFlatSong(raw, { seconds: true }));

  if (songs.length === 0) throw new Error("KG 每日推荐返回空列表");
  return { code: 200, songs };
};

export default everydayRecommend;
