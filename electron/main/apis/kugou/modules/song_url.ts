import type { KGModule } from "../core/types";
import { ensureKugouDfid } from "../core/device";
import { getDeviceMid, signKey } from "../core/crypto";
import { kgGatewayRequest } from "../core/request";
import { getSessionCookies } from "@main/database/sessions";
import { isKugouConceptMode, getKgAppid, getKgClientver } from "../core/config";
import { coreLog } from "@main/utils/logger";

/** 音质档位，按从低到高排序 */
const QUALITY_LEVELS = ["128", "320", "flac", "high"] as const;
type QualityLevel = (typeof QUALITY_LEVELS)[number];

const QUALITY_MAP: Record<string, QualityLevel> = {
  "hi-res": "high",
  lossless: "flac",
  hq: "320",
  sq: "128",
  lq: "128",
};

/** 试听片段判定阈值，低于该时长视为非完整音源 */
const TRIAL_MAX_SECONDS = 60;

interface PrivilegeVariant {
  hash?: string;
  level?: number;
  quality?: string;
}

interface PrivilegeData {
  data?: Array<PrivilegeVariant & { relate_goods?: PrivilegeVariant[] }>;
}

/** 直链响应中的音源字段 */
interface UrlResponse {
  url?: string | string[];
  backup_url?: string | string[];
  backupUrl?: string | string[];
  extName?: string;
  timeLength?: number;
  bitRate?: number;
  [key: string]: unknown;
}

/**
 * 收集响应里的全部直链，主地址失败时可用备用 CDN
 * @param response - /v5/url 响应
 * @returns 非空直链列表
 */
const extractUrls = (response: UrlResponse): string[] =>
  [response.url, response.backup_url, response.backupUrl]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string" && value.length > 0);

/**
 * privilege/lite 枚举账号在各音质档位可用的变体
 * 每档的 hash 与原始 hash 不同，必须按账号权益取值
 * @param hash - 原始音频 hash
 * @param albumId - 专辑 id
 * @returns quality → hash 映射；无权益时为空
 */
const fetchLiteQualityOptions = async (
  hash: string,
  albumId: number,
): Promise<Map<QualityLevel, string>> => {
  const resp = await kgGatewayRequest<PrivilegeData>("/v2/get_res_privilege/lite", {
    method: "POST",
    headers: { "x-router": "media.store.kugou.com" },
    data: {
      appid: getKgAppid(),
      clientver: getKgClientver(),
      area_code: 1,
      behavior: "play",
      need_hash_offset: 1,
      relate: 1,
      support_verify: 1,
      resource: [{ type: "audio", page_id: 0, hash, album_id: albumId }],
      qualities: QUALITY_LEVELS,
    },
  });
  const options = new Map<QualityLevel, string>();
  for (const item of resp.data ?? []) {
    for (const variant of [item, ...(item.relate_goods ?? [])]) {
      const quality = variant.quality as QualityLevel | undefined;
      if (!variant.hash || !quality) continue;
      if (!QUALITY_LEVELS.includes(quality) || options.has(quality)) continue;
      options.set(quality, variant.hash);
    }
  }
  return options;
};

/**
 * 请求单档音质直链
 * @param hash - 该档位对应的音频 hash
 * @param quality - 音质档位
 * @param albumId - 专辑 id
 * @param audioId - 专辑音频 id，概念版传 0 才能取到完整音源
 * @param userid - 当前账号
 * @param freePart - 是否只取免费片段
 * @returns 接口原始响应
 */
const requestUrl = async (
  hash: string,
  quality: string,
  albumId: number,
  audioId: number,
  userid: number,
  freePart: boolean,
): Promise<UrlResponse> => {
  const concept = isKugouConceptMode();
  return await kgGatewayRequest<UrlResponse>("/v5/url", {
    params: {
      album_id: albumId,
      area_code: 1,
      hash,
      ssa_flag: "is_fromtrack",
      version: 11430,
      page_id: concept ? 967177915 : 151369488,
      quality,
      album_audio_id: audioId,
      behavior: "play",
      pid: concept ? 411 : 2,
      cmd: 26,
      pidversion: 3001,
      IsFreePart: freePart ? 1 : 0,
      vipType: Number(getSessionCookies("kugou").vip_type ?? 0),
      ppage_id: concept ? "356753938" : "463467626,350369493,788954147",
      cdnBackup: 1,
      module: "",
      clientver: 11430,
      key: signKey(hash, getDeviceMid(), userid),
    },
    headers: { "x-router": "trackercdn.kugou.com" },
  });
};

const songUrl: KGModule = async (params) => {
  const hash = String(params.hash ?? "").toLowerCase();
  if (!hash) throw new Error("KG song hash missing");
  await ensureKugouDfid();
  const session = getSessionCookies("kugou");
  const userid = Number(session.userid || 0);
  const albumId = Number(params.albumId ?? 0);
  // 概念版必须传 0：传 audio_id 会被降级为 30 秒试听
  const audioId = isKugouConceptMode() ? 0 : Number(params.audioId ?? 0);
  const preferred = QUALITY_MAP[String(params.level ?? "hq")] ?? "320";

  // 从偏好音质向下逐档尝试
  const fallbackChain = QUALITY_LEVELS.slice(0, QUALITY_LEVELS.indexOf(preferred) + 1).reverse();
  let candidates = fallbackChain.map((quality) => ({ hash, quality }));

  // 已登录账号通过 privilege/lite 取各档位对应的真实 hash
  if (session.token) {
    try {
      const options = await fetchLiteQualityOptions(hash, albumId);
      const privileged = fallbackChain
        .map((quality) => ({ quality, variantHash: options.get(quality) }))
        .filter((item) => Boolean(item.variantHash))
        .map((item) => ({ hash: item.variantHash as string, quality: item.quality }));
      if (privileged.length > 0) candidates = privileged;
    } catch (err) {
      coreLog.warn("[kg-song-url] privilege/lite 失败，回退原始 hash:", err);
    }
  }

  let lastResponse: UrlResponse = {};
  for (const candidate of candidates) {
    const response = await requestUrl(
      candidate.hash.toLowerCase(),
      candidate.quality,
      albumId,
      audioId,
      userid,
      Boolean(params.freePart),
    );
    lastResponse = response;
    const urls = extractUrls(response);
    if (urls.length === 0 || response.extName === "mp4") continue;
    const timeLength = Number(response.timeLength ?? 0);
    const trial = timeLength > 0 && timeLength < TRIAL_MAX_SECONDS;
    if (candidate.quality !== preferred) {
      coreLog.info(`[kg-song-url] ${preferred} 不可用，降档至 ${candidate.quality}`);
    }
    return { code: 200, data: { url: urls[0], backupUrl: urls[1], isTrial: trial } };
  }

  return {
    code: Number(lastResponse.errcode ?? 500),
    message: String(lastResponse.error ?? ""),
    data: undefined,
  };
};

export default songUrl;
