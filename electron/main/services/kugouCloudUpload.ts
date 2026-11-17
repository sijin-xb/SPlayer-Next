import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { getSessionCookies } from "@main/database/sessions";
import {
  getDeviceMid,
  signParamsKey,
  signatureAndroidParams,
  cryptoMd5,
  encryptKugouDeviceData,
  rsaEncryptKugouPkcs1,
} from "@main/apis/kugou/core/crypto";
import { getKgAppid, getKgClientver } from "@main/apis/kugou/core/config";
import { kgGatewayRequest } from "@main/apis/kugou/core/request";
import { coreLog } from "@main/utils/logger";

const BUCKET = "musicclound";
const VERIFY_SALT = "8ae10344e9738dcb";
const PART_SIZE = 1024 * 1024;

/** 上传结果 */
export interface CloudUploadResult {
  ok: boolean;
  /** 曲库命中时返回已有曲目信息 */
  matched?: { albumAudioId: number; audioId: number; hash: string; name: string };
  error?: string;
}

/** 云盘上传所用的请求头，模拟客户端 */
const uploadHeaders = (): Record<string, string> => ({
  "User-Agent": `Android15-1070-${getKgClientver()}-201-0-wifi`,
  "KG-RC": "1",
  "KG-Rec": "1",
  "KG-THash": Math.floor(Math.random() * 0xfffffff)
    .toString(16)
    .padStart(7, "0"),
});

/**
 * 给 BSS 请求参数补签名
 * @param params - 原始参数
 * @returns 补签名后的参数
 */
const signBss = (params: Record<string, unknown>): Record<string, unknown> => {
  params.signature = signatureAndroidParams(params, "");
  return params;
};

/**
 * 上传本地文件到酷狗云盘
 * 先按文件 MD5 查曲库，命中则直接添加引用；未命中走五步分片上传
 * @param filePath - 本地文件绝对路径
 * @returns 上传结果
 */
export const uploadToKugouCloud = async (filePath: string): Promise<CloudUploadResult> => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) return { ok: false, error: "KG 未登录" };

  let file: Buffer;
  try {
    file = await readFile(filePath);
  } catch (error) {
    return { ok: false, error: `读取文件失败: ${String(error)}` };
  }
  if (file.length === 0) return { ok: false, error: "文件为空" };

  const appid = getKgAppid();
  const clientver = getKgClientver();
  const filename = createHash("md5").update(file).digest("hex");
  const extend = extname(filePath).replace(/^\./, "") || "mp3";
  const mid = getDeviceMid();
  const dfid = session.dfid ?? "-";
  const uuid = "-";
  const userid = String(session.userid);

  // 曲库匹配：命中可直接引用，不必上传实体
  let match: CloudUploadResult["matched"];
  try {
    const matchResponse = await kgGatewayRequest<{ status?: number; data?: unknown[] }>(
      "/v2/album_audio/audio",
      {
        baseURL: "http://kmr.service.kugou.com",
        method: "POST",
        notSignature: true,
        headers: { "x-router": "kmr.service.kugou.com", "Content-Type": "application/json" },
        data: {
          appid,
          clienttime: Math.floor(Date.now() / 1000),
          clientver,
          data: [{ hash: filename }],
          dfid,
          key: signParamsKey(String(Math.floor(Date.now() / 1000)), appid, clientver),
          mid,
          show_privilege: 0,
          show_author_alias: 0,
          show_rel_album_audio_info: 0,
          show_remarks: 0,
        },
      },
    );
    const first = (matchResponse.data?.[0] ?? null) as Record<string, unknown> | null;
    if (first) {
      match = {
        albumAudioId: Number(first.album_audio_id ?? 0),
        audioId: Number(first.audio_id ?? 0),
        hash: String(first.hash ?? ""),
        name: String(first.ori_audio_name ?? first.audio_name ?? ""),
      };
    }
  } catch (error) {
    coreLog.warn("[kg-cloud] 曲库匹配失败，继续走上传:", error);
  }

  const hashStd = match?.hash || filename;
  const audioId = match?.audioId ?? 0;
  const albumAudioId = match?.albumAudioId ?? 0;
  const trackName = match?.name || basename(filePath, extname(filePath));
  const displayName = `${trackName}.${extend}`;

  try {
    const verifyCode = cryptoMd5(`${appid}${BUCKET}${VERIFY_SALT}`);

    const authParams = signBss({
      bucket: BUCKET,
      filename,
      method: "POST",
      loginType: session.token ? 1 : 0,
      buVerifyCode: verifyCode,
      extranet: 1,
      userid,
      token: session.token,
      version: clientver,
      dfid,
      mid,
      uuid,
      appid,
      clientver,
      clienttime: Math.floor(Date.now() / 1000),
    });
    const authRes = await fetch(
      `https://gateway.kugou.com/bsstrackercdngz/v1/upload/auth?${new URLSearchParams(
        Object.entries(authParams).map(([k, v]) => [k, String(v)]),
      ).toString()}`,
      { headers: uploadHeaders() },
    );
    const authBody = (await authRes.json()) as { data?: { authorization?: string } };
    const authorization = authBody.data?.authorization;
    if (!authorization) throw new Error("获取上传授权失败");

    const initParams = signBss({
      bucket: BUCKET,
      filename,
      ssl: 1,
      extendname: extend,
      version: clientver,
      userid,
      token: session.token,
      authorization,
      dfid,
      mid,
      uuid,
      appid,
      clientver,
      clienttime: Math.floor(Date.now() / 1000),
    });
    const initRes = await fetch(
      `http://bssulbig.kugou.com/v2/multipart/initiate/music?${new URLSearchParams(
        Object.entries(initParams).map(([k, v]) => [k, String(v)]),
      ).toString()}`,
      { method: "POST", headers: { ...uploadHeaders(), Authorization: authorization } },
    );
    const initBody = (await initRes.json()) as {
      data?: { external_host?: string; upload_id?: string; "x-bss-filename"?: string };
    };
    const initData = initBody.data ?? {};
    let bssFileHash = initData["x-bss-filename"] || filename;

    if (initData.upload_id && initData.external_host) {
      const host = initData.external_host.replace(/^(?!https?:\/\/)/i, "http://");
      const partCount = Math.max(1, Math.ceil(file.length / PART_SIZE));

      for (let index = 0; index < partCount; index++) {
        const partParams = signBss({
          bucket: BUCKET,
          authorization,
          filename,
          partnumber: index + 1,
          upload_id: initData.upload_id,
          body_empty: 1,
          version: clientver,
          userid,
          token: session.token,
          dfid,
          mid,
          uuid,
          appid,
          clientver,
          clienttime: Math.floor(Date.now() / 1000),
        });
        const partRes = await fetch(
          `${host}/v3/multipart/upload?${new URLSearchParams(
            Object.entries(partParams).map(([k, v]) => [k, String(v)]),
          ).toString()}`,
          {
            method: "POST",
            headers: {
              ...uploadHeaders(),
              Authorization: authorization,
              "Content-Type": "application/octet-stream",
            },
            body: new Uint8Array(file.subarray(index * PART_SIZE, (index + 1) * PART_SIZE)),
          },
        );
        const partBody = (await partRes.json()) as { status?: number };
        if (partBody.status !== 1) throw new Error(`分片 ${index + 1} 上传失败`);
      }

      const completeParams = signBss({
        bucket: BUCKET,
        authorization,
        filename,
        partnumber: partCount,
        upload_id: initData.upload_id,
        md5: filename,
        version: clientver,
        userid,
        token: session.token,
        if_id3: 1,
        dfid,
        mid,
        uuid,
        appid,
        clientver,
        clienttime: Math.floor(Date.now() / 1000),
      });
      const completeRes = await fetch(
        `${host}/v3/multipart/complete?${new URLSearchParams(
          Object.entries(completeParams).map(([k, v]) => [k, String(v)]),
        ).toString()}`,
        { method: "POST", headers: { ...uploadHeaders(), Authorization: authorization } },
      );
      const completeBody = (await completeRes.json()) as {
        status?: number;
        data?: Array<Record<string, string>>;
      };
      if (completeBody.status !== 1) throw new Error("完成上传失败");
      bssFileHash = completeBody.data?.[0]?.["x-bss-filename"] || bssFileHash;
    }

    const encrypted = encryptKugouDeviceData({
      data: [
        {
          name: displayName,
          ext: extend,
          author_name: match?.name ? "" : "",
          hash: bssFileHash,
          hash_std: hashStd,
          audio_id: audioId,
          bitrate: 4,
          album_audio_id: albumAudioId,
          size: file.length,
          timelen: 0,
        },
      ],
      list_ver: 0,
    });
    const clienttime = Math.floor(Date.now() / 1000);
    const addParams = new URLSearchParams({
      clienttime: String(clienttime),
      mid,
      key: signParamsKey(String(clienttime), appid, clientver),
      clientver: String(clientver),
      appid: String(appid),
      p: rsaEncryptKugouPkcs1({
        aes: encrypted.key,
        uid: userid,
        token: session.token,
      }).toUpperCase(),
    });
    const addRes = await fetch(
      `https://mcloudservice.kugou.com/v1/add_files?${addParams.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", ...uploadHeaders() },
        body: new Uint8Array(Buffer.from(encrypted.content, "base64")),
      },
    );
    if (!addRes.ok) throw new Error(`添加文件到云盘失败 HTTP ${addRes.status}`);

    return { ok: true, matched: match };
  } catch (error) {
    coreLog.warn("[kg-cloud] 上传失败:", error);
    return { ok: false, error: String(error) };
  }
};
