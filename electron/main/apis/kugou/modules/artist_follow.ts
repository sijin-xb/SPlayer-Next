import type { KGModule } from "../core/types";
import { getSessionCookies } from "@main/database/sessions";
import { kgGatewayRequest } from "../core/request";
import { encryptKugouParams, rsaEncryptKugouPkcs1 } from "../core/crypto";

interface FollowParams {
  singerid: number;
  token: string;
}

/**
 * 关注歌手
 * 参数经通用 AES 加密后，随机密钥再经 RSA 包装进 p 字段
 * @param params - singerid 歌手 id，action 为 add / del
 * @returns 操作结果
 */
const artistFollow: KGModule = async (params) => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) throw new Error("KG 未登录，无法关注歌手");
  const singerid = Number(params.singerid);
  if (!singerid) throw new Error("KG 关注歌手缺少 singerid");

  const clienttime = Math.floor(Date.now() / 1000);
  const encrypt = encryptKugouParams({ singerid, token: session.token } satisfies FollowParams);
  const path =
    params.action === "del"
      ? "/followservice/v3/unfollow_singer"
      : "/followservice/v3/follow_singer";

  await kgGatewayRequest(path, {
    method: "POST",
    data: {
      plat: 0,
      userid: Number(session.userid),
      singerid,
      source: 7,
      p: rsaEncryptKugouPkcs1({ clienttime, key: encrypt.key }).toUpperCase(),
      params: encrypt.content,
    },
    params: { clienttime },
  });

  return { code: 200 };
};

export default artistFollow;
