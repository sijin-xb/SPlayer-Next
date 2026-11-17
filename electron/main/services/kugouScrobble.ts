import type { Track } from "@shared/types/player";
import { store } from "@main/store";
import { callKugou, getKugouSession } from "@main/apis/kugou";
import { coreLog } from "@main/utils/logger";
import { createPlayProgress } from "@main/services/playProgress";

interface PlaybackRound {
  mxid: number;
  title: string;
  account: string;
}

const MAX_PENDING_REPORTS = 16;
let pendingReports = 0;
let current: PlaybackRound | null = null;
let isPlaying = false;

/**
 * 上报一轮播放
 * @param round - 本轮曲目与所属账号
 */
const report = (round: PlaybackRound): void => {
  if (pendingReports >= MAX_PENDING_REPORTS) {
    coreLog.warn("[kgscrobble] 上报任务过多，本次跳过");
    return;
  }
  pendingReports++;
  void callKugou("playhistory_upload", {
    mxid: round.mxid,
    time: Math.floor(Date.now() / 1000),
    pc: 1,
  })
    .then(() => coreLog.debug(`[kgscrobble] 已上报: ${round.title}`))
    .catch((error) => coreLog.warn("[kgscrobble] 上报失败:", error))
    .finally(() => {
      pendingReports--;
    });
};

/**
 * 播放回合只属于开始时的账号，切号后不转移
 * @param round - 待上报回合
 * @returns 当前配置与账号是否允许上报
 */
const canReport = (round: PlaybackRound): boolean =>
  Boolean(
    store.get("system.kugouScrobbleEnabled") &&
    round.account &&
    round.account === getKugouSession().userid,
  );

const progress = createPlayProgress<PlaybackRound>({
  onSettle: (round, playedMs) => {
    if (canReport(round) && playedMs > 0) report(round);
  },
});

/** 只上报酷狗来源的曲目，mxid 取 audio_id */
const toRound = (track: Track | null): PlaybackRound | null => {
  if (!track || track.source !== "kugou") return null;
  const mxid = Number(track.extId ?? 0);
  if (!Number.isFinite(mxid) || mxid <= 0) return null;
  return { mxid, title: track.title, account: getKugouSession().userid ?? "" };
};

/**
 * 切歌时结算旧回合
 * @param track - 渲染层下发的曲目
 * @param durationMs - 引擎确认的时长
 * @param autoPlay - 是否自动播放
 */
export const onTrackLoaded = (track: Track | null, durationMs: number, autoPlay: boolean): void => {
  const round = toRound(track);
  current = round;
  isPlaying = autoPlay;
  progress.load(durationMs / 1000, current, autoPlay);
};

/**
 * 暂停期间不累计时间
 * @param playing - 是否正在播放
 */
export const onState = (playing: boolean): void => {
  isPlaying = playing;
  progress.setPlaying(playing);
};

/** 进度跳转不增加实际收听时间 */
export const onPosition = (): void => {
  if (isPlaying) progress.setPlaying(true);
};

/** 自然结束结算 */
export const onEnded = (): void => {
  isPlaying = false;
  progress.end();
};

/** 单曲循环重播开启新回合 */
export const onRepeatOneRestart = (): void => {
  isPlaying = false;
  if (!current) return;
  progress.load(0, current, false);
};

/** 主动停止结算后释放曲目信息 */
export const onStopped = (): void => {
  isPlaying = false;
  progress.end();
  current = null;
};
