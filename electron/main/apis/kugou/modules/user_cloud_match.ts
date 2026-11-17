import type { KGModule } from "../core/types";
import { getSessionCookies } from "@main/database/sessions";
import { kgGatewayRequest } from "../core/request";
import { getKgAppid, getKgClientver } from "../core/config";
import { signParamsKey } from "../core/crypto";

interface MatchCandidate {
  album_audio_id?: number;
  audio_id?: number;
  hash?: string;
  author_name?: string;
  audio_name?: string;
  ori_audio_name?: string;
  [key: string]: unknown;
}

/**
 * 云盘上传前的曲库匹配
 * 命中说明酷狗曲库已有该文件，可直接引用，无需上传实体
 * @param params - hash 文件 md5
 * @returns 匹配结果，未命中时 match 为 null
 */
const cloudMatch: KGModule = async (params) => {
  const hash = String(params.hash ?? "").toLowerCase();
  if (!hash) throw new Error("KG 云盘匹配缺少文件 hash");

  const session = getSessionCookies("kugou");
  const clienttime = String(Math.floor(Date.now() / 1000));
  const appid = getKgAppid();
  const clientver = getKgClientver();

  const response = await kgGatewayRequest<{ status?: number; data?: unknown[] }>(
    "/v2/album_audio/audio",
    {
      baseURL: "http://kmr.service.kugou.com",
      method: "POST",
      notSignature: true,
      headers: {
        "x-router": "kmr.service.kugou.com",
        "Content-Type": "application/json",
      },
      data: {
        appid,
        clienttime: Number(clienttime),
        clientver,
        data: [{ hash }],
        dfid: session.dfid ?? "-",
        key: signParamsKey(clienttime, appid, clientver),
        mid: session.mid ?? "",
        show_privilege: 0,
        show_author_alias: 0,
        show_rel_album_audio_info: 0,
        show_remarks: 0,
      },
    },
  );

  const list = Array.isArray(response.data) ? response.data : [];
  const first = (list[0] ?? null) as MatchCandidate | null;
  if (!first) return { code: 200, match: null };

  return {
    code: 200,
    match: {
      albumAudioId: Number(first.album_audio_id ?? 0),
      audioId: Number(first.audio_id ?? 0),
      hash: String(first.hash ?? ""),
      name: String(first.ori_audio_name ?? first.audio_name ?? ""),
      author: String(first.author_name ?? ""),
    },
  };
};

export default cloudMatch;
