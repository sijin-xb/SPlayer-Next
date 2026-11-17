import type { KGModule } from "../core/types";
import { getSessionCookies } from "@main/database/sessions";
import { kgGatewayRequest } from "../core/request";

/**
 * 提交听歌历史
 * 只在真实结算时调用，mxid 为曲目 audio_id
 * @param params - mxid 曲目 id，time 秒级时间戳，pc 播放次数
 * @returns 提交结果
 */
const playhistoryUpload: KGModule = async (params) => {
  const session = getSessionCookies("kugou");
  if (!session.token || !session.userid) throw new Error("KG 未登录，无法上报听歌历史");
  const mxid = Number(params.mxid);
  if (!Number.isFinite(mxid) || mxid <= 0) throw new Error("KG 上报缺少有效 mxid");

  await kgGatewayRequest("/playhistory/v1/upload_songs", {
    method: "POST",
    params: { plat: 3 },
    data: {
      songs: [
        {
          mxid,
          op: 1,
          ot: params.time ?? Math.floor(Date.now() / 1000),
          pc: params.pc ?? 1,
        },
      ],
      token: session.token,
      userid: session.userid,
    },
  });

  return { code: 200 };
};

export default playhistoryUpload;
