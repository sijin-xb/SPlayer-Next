import type { Track } from "@shared/types/player";
import { ErrorCode } from "@shared/types/errors";
import { getQualityLevel, type QualityLevel } from "@/utils/quality";
import { kugouCall } from "@/apis/kugou";
import { KUGOU_CLOUD_MARK } from "@/apis/cloud/kugou";

export type KugouPlayUrlResult =
  { available: true; url: string; isTrial: boolean } | { available: false; errorCode: ErrorCode };

interface SongUrlResponse {
  code: number;
  data?: { url?: string };
}

interface CloudUrlResponse {
  code: number;
  url?: string;
}

const QUALITY_ORDER: QualityLevel[] = ["lq", "sq", "hq", "lossless", "hi-res"];

const clampQuality = (requested: QualityLevel, track: Track): QualityLevel => {
  const available = getQualityLevel(track.quality);
  return QUALITY_ORDER[
    Math.min(QUALITY_ORDER.indexOf(requested), QUALITY_ORDER.indexOf(available))
  ];
};

export const resolveKugouUrl = async (
  track: Track,
  level: QualityLevel,
): Promise<KugouPlayUrlResult> => {
  try {
    // 云盘曲目走专用地址接口，与普通曲库不是同一套
    if (track.comment === KUGOU_CLOUD_MARK) {
      const cloud = await kugouCall<CloudUrlResponse>("user_cloud_url", {
        hash: track.id,
        audioId: track.extId,
        name: track.title,
      });
      if (cloud.code === 200 && cloud.url) {
        return { available: true, url: cloud.url, isTrial: false };
      }
      return { available: false, errorCode: ErrorCode.URL_RESOLVE_FAILED };
    }
    const result = await kugouCall<SongUrlResponse>("song_url", {
      hash: track.id,
      audioId: track.extId,
      albumId: track.album?.id,
      level: clampQuality(level, track),
    });
    if (result.code === 200 && result.data?.url) {
      return { available: true, url: result.data.url, isTrial: false };
    }
  } catch (error) {
    console.warn("[kugou] resolve URL failed:", error);
  }
  return { available: false, errorCode: ErrorCode.URL_RESOLVE_FAILED };
};
