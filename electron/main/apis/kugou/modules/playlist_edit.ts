import type { KGModule } from "../core/types";
import { getSessionCookies } from "@main/database/sessions";
import { kgGatewayRequest } from "../core/request";
import { encryptKugouDeviceData, rsaEncryptKugouPkcs1, signParamsKey } from "../core/crypto";

interface SongRef {
  name?: string;
  hash?: string;
  albumId?: number;
  mixsongid?: number;
}

/**
 * 向歌单添加歌曲
 * @param params - listid 目标歌单，songs 曲目引用数组
 * @returns 操作结果
 */
export const playlistAddSongs: KGModule = async (params) => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) throw new Error("KG 未登录，无法编辑歌单");
  const listid = String(params.listid ?? "");
  const songs = params.songs as SongRef[] | undefined;
  if (!listid || !songs?.length) throw new Error("KG 歌单操作缺少参数");

  const clienttime = Math.floor(Date.now() / 1000);
  const resource = songs.map((song) => ({
    number: 1,
    name: song.name ?? "",
    hash: song.hash ?? "",
    size: 0,
    sort: 0,
    timelen: 0,
    bitrate: 0,
    album_id: Number(song.albumId ?? 0),
    mixsongid: Number(song.mixsongid ?? 0),
  }));

  await kgGatewayRequest("/cloudlist.service/v6/add_song", {
    method: "POST",
    params: {
      last_time: clienttime,
      last_area: "gztx",
      userid: session.userid,
      token: session.token,
    },
    data: {
      userid: session.userid,
      token: session.token,
      listid,
      list_ver: 0,
      type: 0,
      slow_upload: 1,
      scene: "false;null",
      data: resource,
    },
  });

  return { code: 200 };
};

/**
 * 从歌单删除歌曲
 * @param params - listid 目标歌单，fileids 歌单内 fileid 数组
 * @returns 操作结果
 */
export const playlistDeleteSongs: KGModule = async (params) => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) throw new Error("KG 未登录，无法编辑歌单");
  const listid = String(params.listid ?? "");
  const fileids = params.fileids as number[] | undefined;
  if (!listid || !fileids?.length) throw new Error("KG 删除歌单歌曲缺少参数");

  await kgGatewayRequest("/v4/delete_songs", {
    method: "POST",
    headers: { "x-router": "cloudlist.service.kugou.com" },
    data: {
      listid,
      userid: session.userid,
      data: fileids.map((fileid) => ({ fileid: Number(fileid) })),
      type: 0,
      token: session.token,
      list_ver: 0,
    },
  });

  return { code: 200 };
};

/**
 * 创建歌单
 * @param params - name 歌单名，private 是否私密
 * @returns 新歌单标识
 */
export const playlistCreate: KGModule = async (params) => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) throw new Error("KG 未登录，无法创建歌单");
  const name = String(params.name ?? "").trim();
  if (!name) throw new Error("KG 歌单名不能为空");

  const clienttime = Math.floor(Date.now() / 1000);
  const response = await kgGatewayRequest<{ data?: { listid?: number | string } }>(
    "/cloudlist.service/v5/add_list",
    {
      method: "POST",
      params: {
        last_time: clienttime,
        last_area: "gztx",
        userid: session.userid,
        token: session.token,
      },
      data: {
        userid: session.userid,
        token: session.token,
        total_ver: 0,
        name,
        type: 0,
        source: 1,
        is_pri: params.private ? 1 : 0,
        list_create_userid: session.userid,
        list_create_listid: 0,
        list_create_gid: "",
        from_shupinmv: 0,
      },
    },
  );

  return { code: 200, listid: response.data?.listid ?? null };
};

/**
 * 取消收藏歌单（移除账号下收藏的列表，listid 来自用户歌单里的收藏条目）
 * 请求规格对齐 kugou-tui 的 KAT：AES 密文 body 参与 android 签名，
 * p 为 RSA 包装的 {aes, uid, token}，路由经 x-router 指向 cloudlist
 * @param params - listid 收藏列表的数字 id
 * @returns 操作结果
 */
export const playlistUnsubscribe: KGModule = async (params) => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) throw new Error("KG 未登录，无法取消收藏歌单");
  const listid = Number(params.listid);
  if (!listid) throw new Error("KG 取消收藏歌单缺少 listid");

  const clienttime = Math.floor(Date.now() / 1000);
  const enc = encryptKugouDeviceData({ listid, total_ver: 0, type: 1 });
  await kgGatewayRequest("/v2/delete_list", {
    method: "POST",
    headers: {
      "x-router": "cloudlist.service.kugou.com",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    params: {
      key: signParamsKey(String(clienttime)),
      last_area: "gztx",
      last_time: clienttime,
      p: rsaEncryptKugouPkcs1({
        aes: enc.key,
        uid: session.userid,
        token: session.token,
      }).toUpperCase(),
    },
    data: enc.content,
  });

  return { code: 200 };
};
