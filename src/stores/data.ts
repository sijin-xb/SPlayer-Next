import localforage from "localforage";
import type { Track } from "@shared/types/player";
import type { Platform, PlatformProfile } from "@shared/types/platform";
import { fetchDailySongs } from "@/apis/recommend/netease";
import { fetchKugouDailySongs } from "@/apis/recommend/kugou";
import { useSettingsStore } from "@/stores/settings";
import { useUserStore } from "@/stores/user";

const MAX_SEARCH_HISTORY = 20;
/** 每日推荐归档保留天数 */
const MAX_DAILY_ARCHIVE = 14;

const cacheDb = localforage.createInstance({ name: "splayer", storeName: "data-cache" });

/** 每日推荐逻辑日切换时刻：每日 6:00 更新，0-6 点仍算前一天 */
const DAILY_REFRESH_HOUR = 6;

/** 每日推荐逻辑日 key */
const todayKey = (): string =>
  new Date(Date.now() - DAILY_REFRESH_HOUR * 3600 * 1000).toDateString();

/** 一天的每日推荐 */
export interface DailyRecommendEntry {
  /** 本地日期 key（Date.toDateString()，可被 new Date() 解析回 Date） */
  date: string;
  /** 当天推荐曲目 */
  tracks: Track[];
}

/**
 * 通用本地数据 store
 * 用于沉淀那些跨页面、需持久化、但不归属任何业务模块的小块数据
 */
export const useDataStore = defineStore(
  "data",
  () => {
    /** 搜索历史（最新在前，去重，最多 20 条） */
    const searchHistory = ref<string[]>([]);

    /** 写入搜索历史 */
    const addSearchHistory = (keyword: string): void => {
      const word = keyword.trim();
      if (!word) return;
      const next = [word, ...searchHistory.value.filter((existing) => existing !== word)];
      if (next.length > MAX_SEARCH_HISTORY) next.length = MAX_SEARCH_HISTORY;
      searchHistory.value = next;
    };

    /** 移除某条搜索历史 */
    const removeSearchHistory = (keyword: string): void => {
      searchHistory.value = searchHistory.value.filter((existing) => existing !== keyword);
    };

    /** 清空搜索历史 */
    const clearSearchHistory = (): void => {
      searchHistory.value = [];
    };

    const user = useUserStore();

    /** 每日推荐归档 */
    let dailyArchive: DailyRecommendEntry[] = [];
    /** 当前内存归档归属的账号标识（`平台:userId`） */
    let dailyArchiveUserId: string | null = null;
    /** 今日每日推荐曲目 */
    const dailyRecommend = shallowRef<Track[]>([]);
    /** 历史每日推荐（不含今日，最新在前） */
    const dailyHistory = shallowRef<DailyRecommendEntry[]>([]);
    /** 进行中的拉取，去重并发调用 */
    let dailyRecommendLoading: Promise<Track[]> | null = null;

    /** 用归档刷新今日 / 历史两个对外 ref */
    const syncDaily = (): void => {
      const head = dailyArchive[0];
      const todayReady = head?.date === todayKey();
      dailyRecommend.value = todayReady ? (head?.tracks ?? []) : [];
      dailyHistory.value = todayReady ? dailyArchive.slice(1) : dailyArchive;
    };

    const settings = useSettingsStore();

    /** 当前生效的在线平台，账号态功能以它为准 */
    const activePlatform = (): Platform => settings.system.system.onlinePlatform;

    /** 各平台的登录资料 */
    const platformProfiles = ref<Partial<Record<Platform, PlatformProfile>>>({});

    /**
     * 获取指定平台的登录资料
     * @param platform - 平台标识
     */
    const getPlatformProfile = (platform: Platform): PlatformProfile | null =>
      platformProfiles.value[platform] ?? null;

    /**
     * 取指定平台当前登录账号的标识
     * 网易云登录态仍由 user store 独占，其余平台走 platformProfiles
     * @param platform - 平台标识
     * @returns 账号标识，未登录返回 null
     */
    const dailyAccount = (platform: Platform): string | null => {
      if (platform === "netease") {
        const uid = user.profile?.userId;
        return uid == null ? null : String(uid);
      }
      return getPlatformProfile(platform)?.userId ?? null;
    };

    /** 当前生效的平台是否已登录 */
    const isActivePlatformLoggedIn = computed<boolean>(() => {
      void platformProfiles.value;
      return dailyAccount(activePlatform()) !== null;
    });

    /**
     * 取每日推荐曲目：当天已有直接返回，否则按 IndexedDB → 网络 顺序获取
     * 缓存按「平台:账号」分键，平台间与账号间互不覆盖
     * 新一天的数据会把旧数据沉淀进历史归档（IndexedDB 持久化，保留近 14 天）
     * 逻辑日以 6:00 为界，未登录或失败返回空数组。各处可直接调用，已就绪时即时返回
     * @param force - 强制重新拉取并覆盖当天归档
     */
    const ensureDailyRecommend = async (force = false): Promise<Track[]> => {
      const platform = activePlatform();
      const account = dailyAccount(platform);
      if (account == null) return [];
      const uid = `${platform}:${account}`;
      // 用户或平台切换 → 丢弃旧归档，避免串数据
      if (dailyArchiveUserId !== uid) {
        dailyArchive = [];
        dailyArchiveUserId = uid;
        dailyRecommend.value = [];
        dailyHistory.value = [];
      }
      const cacheKey = `daily-recommend-archive:${uid}`;
      const head = dailyArchive[0];
      if (!force && head?.date === todayKey() && head.tracks.length > 0) {
        return dailyRecommend.value;
      }
      if (dailyRecommendLoading) return dailyRecommendLoading;
      dailyRecommendLoading = (async () => {
        try {
          if (dailyArchive.length === 0) {
            const cached = await cacheDb.getItem<DailyRecommendEntry[]>(cacheKey).catch(() => null);
            if (cached?.length) {
              dailyArchive = cached;
              syncDaily();
            }
          }
          const cachedHead = dailyArchive[0];
          if (!force && cachedHead?.date === todayKey() && cachedHead.tracks.length > 0) {
            return dailyRecommend.value;
          }
          const tracks =
            platform === "kugou" ? await fetchKugouDailySongs() : await fetchDailySongs();
          if (tracks.length > 0) {
            // 当天已在归档则覆盖，否则前插为新的一天
            const rest =
              dailyArchive[0]?.date === todayKey() ? dailyArchive.slice(1) : dailyArchive;
            dailyArchive = [{ date: todayKey(), tracks }, ...rest].slice(0, MAX_DAILY_ARCHIVE);
            syncDaily();
            cacheDb.setItem(cacheKey, dailyArchive).catch(() => {});
          }
          return dailyRecommend.value;
        } catch (error) {
          console.warn("[data] daily recommend failed:", error);
          return dailyRecommend.value;
        } finally {
          dailyRecommendLoading = null;
        }
      })();
      return dailyRecommendLoading;
    };

    /** 辅助平台登录资料 */
    /**
     * 设置指定平台的登录资料
     * @param platform - 平台标识
     * @param profile - 资料对象，为 null 时清除该平台
     */
    const setPlatformProfile = (platform: Platform, profile: PlatformProfile | null): void => {
      const next = { ...platformProfiles.value };
      if (profile) {
        next[platform] = profile;
      } else {
        delete next[platform];
      }
      platformProfiles.value = next;
    };

    /**
     * 清除指定平台的登录资料
     * @param platform - 平台标识
     */
    const clearPlatformProfile = (platform: Platform): void => {
      setPlatformProfile(platform, null);
    };

    return {
      searchHistory,
      addSearchHistory,
      removeSearchHistory,
      clearSearchHistory,
      dailyRecommend,
      dailyHistory,
      ensureDailyRecommend,
      activePlatform,
      isActivePlatformLoggedIn,
      platformProfiles,
      getPlatformProfile,
      setPlatformProfile,
      clearPlatformProfile,
    };
  },
  {
    persist: {
      storage: localStorage,
      pick: ["searchHistory", "platformProfiles"],
    },
  },
);
