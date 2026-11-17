import type { KGModule } from "../core/types";
import type { KGPlaylistItem } from "@shared/types/platform/kugou";
import { getSessionCookies } from "@main/database/sessions";
import { kgGatewayRequest } from "../core/request";
import { getDeviceMid, signParamsKey } from "../core/crypto";
import { getKgAppid, getKgClientver } from "../core/config";
import { decodeName, fillCover } from "../core/config";

interface KGSpecialItem {
  specialid?: number | string;
  global_collection_id?: string;
  specialname?: string;
  imgurl?: string;
  pic?: string;
  creatorname?: string;
  nickname?: string;
  songcount?: number;
  playcount?: number;
  [key: string]: unknown;
}

interface KGSpecialResponse {
  data?: { special_list?: KGSpecialItem[]; total?: number };
  special_list?: KGSpecialItem[];
}

/**
 * 把广场歌单条目转成统一结构
 * @param raw - 接口原始条目
 * @returns 歌单条目
 */
const normalizeSpecial = (raw: KGSpecialItem): KGPlaylistItem => ({
  id: String(raw.specialid ?? raw.global_collection_id ?? ""),
  name: decodeName(raw.specialname ?? ""),
  cover: fillCover(raw.imgurl ?? raw.pic, 300),
  creator: decodeName(raw.creatorname ?? raw.nickname ?? ""),
  trackCount: raw.songcount ?? 0,
  playCount: raw.playcount ?? 0,
});

/**
 * 广场推荐歌单
 * 键序会参与 android 签名，必须与上游报文顺序一致
 * @param params - categoryId 歌单分类，page / pageSize 分页
 * @returns 歌单列表
 */
const specialRecommend: KGModule = async (params) => {
  const categoryId = String(params.categoryId ?? 0);
  const page = String(params.page ?? 1);
  const pageSize = String(params.pageSize ?? 30);
  const session = getSessionCookies("kugou");
  const clienttime = String(Math.floor(Date.now() / 1000));
  const mid = getDeviceMid();

  const body = {
    appid: getKgAppid(),
    mid,
    clientver: getKgClientver(),
    platform: "android",
    clienttime,
    userid: session.userid ?? "0",
    module_id: 1,
    page,
    pagesize: pageSize,
    key: signParamsKey(clienttime),
    special_recommend: {
      withtag: "1",
      withsong: "0",
      sort: 1,
      ugc: 1,
      is_selected: 0,
      withrecommend: 1,
      area_code: 1,
      categoryid: categoryId,
    },
    req_multi: 1,
    retrun_min: 5,
    return_special_falg: 1,
  };

  const response = await kgGatewayRequest<KGSpecialResponse>("/v2/special_recommend", {
    method: "POST",
    headers: {
      "x-router": "specialrec.service.kugou.com",
      "Content-Type": "application/json",
    },
    data: body,
  });

  const list = response.data?.special_list ?? response.special_list ?? [];
  const playlists = list.map(normalizeSpecial).filter((item) => item.id && item.name);
  if (playlists.length === 0) throw new Error("KG 推荐歌单返回空列表");
  return { code: 200, playlists, total: response.data?.total ?? playlists.length };
};

export default specialRecommend;
