import type { KGModule } from "../core/types";
import { getSessionCookies } from "@main/database/sessions";
import {
  decryptKugouDeviceData,
  encryptKugouDeviceData,
  rsaEncryptKugouPkcs1,
  signParamsKey,
} from "../core/crypto";
import { getKgAppid, getKgClientver } from "../core/config";
import { getDeviceMid } from "../core/crypto";

const CLOUD_BASE = "https://mcloudservice.kugou.com";
const CLOUD_TIMEOUT_MS = 10000;

interface CloudSongRaw {
  hash?: string;
  name?: string;
  ori_name?: string;
  filename?: string;
  author_name?: string;
  singername?: string;
  album_name?: string;
  albumname?: string;
  audio_id?: number;
  album_audio_id?: number;
  album_id?: string | number;
  timelen?: number;
  duration?: number;
  size?: number;
  cover?: string;
  [key: string]: unknown;
}

interface CloudListBody {
  data?: { list?: CloudSongRaw[]; total?: number };
  list?: CloudSongRaw[];
  total?: number;
}

/**
 * 发送云盘请求
 * 该域名不参与通用签名，p 参数由 RSA 包装 AES 密钥，正文为 AES 密文
 * @param path - 路径
 * @param payload - 明文载荷
 * @returns 解密后的响应
 */
const cloudRequest = async <T>(path: string, payload: Record<string, unknown>): Promise<T> => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) throw new Error("KG 未登录，无法访问云盘");

  const clienttime = Math.floor(Date.now() / 1000);
  const encrypted = encryptKugouDeviceData(payload);
  const mid = getDeviceMid();
  const userid = session.userid;

  const params = new URLSearchParams({
    clienttime: String(clienttime),
    mid,
    key: signParamsKey(clienttime.toString()),
    clientver: String(getKgClientver()),
    appid: String(getKgAppid()),
    p: rsaEncryptKugouPkcs1({
      aes: encrypted.key,
      uid: userid,
      token: session.token,
    }).toUpperCase(),
    userid,
  });

  const res = await fetch(`${CLOUD_BASE}${path}?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "User-Agent": "Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi",
      mid,
    },
    body: Buffer.from(encrypted.content, "base64"),
    signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`KG 云盘 HTTP ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  return decryptKugouDeviceData(buffer, encrypted.key) as T;
};

/**
 * 云盘歌曲列表
 * @param params - 分页参数
 * @returns 归一化前的原始列表
 */
export const cloudList: KGModule = async (params) => {
  const body = await cloudRequest<CloudListBody>("/v1/get_list", {
    page: params.page ?? 1,
    pagesize: params.pageSize ?? 30,
    getkmr: 1,
  });
  const list = body.data?.list ?? body.list ?? [];
  return { code: 200, songs: list, total: body.data?.total ?? body.total ?? list.length };
};

/**
 * 删除云盘歌曲
 * @param params - hash 列表
 * @returns 删除结果
 */
export const cloudDelete: KGModule = async (params) => {
  const hashes = params.hashes as string[] | undefined;
  if (!hashes?.length) throw new Error("KG 云盘删除缺少 hash");
  await cloudRequest("/v1/del_song", { ...params, hashes });
  return { code: 200 };
};

/**
 * 云盘播放地址
 * @param params - hash 与专辑音频 id
 * @returns 播放地址
 */
export const cloudUrl: KGModule = async (params) => {
  const hash = String(params.hash ?? "").toLowerCase();
  if (!hash) throw new Error("KG 云盘播放地址缺少 hash");
  const session = getSessionCookies("kugou");
  const query = new URLSearchParams({
    hash,
    ssa_flag: "is_fromtrack",
    version: "20102",
    ssl: "0",
    album_audio_id: String(params.albumAudioId ?? 0),
    pid: "20026",
    audio_id: String(params.audioId ?? 0),
    kv_id: "2",
    key: signParamsKey(hash),
    bucket: "musicclound",
    name: String(params.name ?? ""),
    with_res_tag: "0",
    userid: session.userid ?? "0",
  });
  const res = await fetch(
    `https://bsstrackercdngz.kugou.com/bsstrackercdngz/v2/query_musicclound_url?${query.toString()}`,
    {
      headers: {
        "User-Agent": "Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi",
      },
      signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`KG 云盘地址 HTTP ${res.status}`);
  const body = (await res.json()) as {
    url?: string[];
    data?: { url?: string[] };
  };
  const url = body.url?.[0] ?? body.data?.url?.[0];
  if (!url) throw new Error("KG 云盘地址为空");
  return { code: 200, url: url.replace(/^http:\/\//, "https://") };
};

export default cloudList;
