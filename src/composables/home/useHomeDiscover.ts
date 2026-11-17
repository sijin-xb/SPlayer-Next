import type { CoverItem } from "@/types/artist";
import type { Platform } from "@shared/types/platform";
import { useUserStore } from "@/stores/user";
import { useDataStore } from "@/stores/data";
import {
  fetchRecommendPlaylists,
  fetchRadarPlaylists,
  fetchArtists,
  fetchNewAlbums,
} from "@/apis/recommend/netease";
import { fetchKugouRecommendPlaylists } from "@/apis/recommend/kugou";

/** 首页推荐内容缓存有效期 */
const CACHE_TTL = 30 * 60 * 1000;

/** 首页推荐内容缓存 */
interface DiscoverCache {
  at: number;
  platform: Platform;
  loggedIn: boolean;
  recommend: CoverItem[];
  radar: CoverItem[];
  artists: CoverItem[];
  albums: CoverItem[];
}

/** 模块级缓存，跨页面 / 重新挂载复用 */
let cache: DiscoverCache | null = null;

/** 包裹拉取：失败记日志并回退空数组，单区块失败不影响整体 */
const safe = (label: string, task: Promise<CoverItem[]>): Promise<CoverItem[]> =>
  task.catch((error) => {
    console.warn(`[home] ${label} failed:`, error);
    return [];
  });

/**
 * 首页推荐内容
 *
 * 聚合「推荐歌单 / 雷达 / 歌手 / 新碟」四个区块，统一拉取与缓存
 * 命中缓存（30 分钟内、登录态一致）直接复用，避免重新挂载首页时重复请求
 */
export const useHomeDiscover = () => {
  const { t } = useI18n();
  const user = useUserStore();
  const data = useDataStore();

  /** 推荐歌单 / 专属歌单 */
  const recommendPlaylists = shallowRef<CoverItem[]>([]);
  /** 雷达歌单 */
  const radarPlaylists = shallowRef<CoverItem[]>([]);
  /** 歌手推荐 */
  const artists = shallowRef<CoverItem[]>([]);
  /** 新碟上架 */
  const newAlbums = shallowRef<CoverItem[]>([]);

  /** 推荐歌单标题 */
  const recommendTitle = computed(() =>
    data.isActivePlatformLoggedIn ? t("home.recommend.title") : t("home.recommend.titleGuest"),
  );
  /** 推荐歌单副标题 */
  const recommendSubtitle = computed(() =>
    data.isActivePlatformLoggedIn
      ? t("home.recommend.subtitle")
      : t("home.recommend.subtitleGuest"),
  );

  /** 用缓存填充各区块 */
  const apply = (entry: DiscoverCache): void => {
    recommendPlaylists.value = entry.recommend;
    radarPlaylists.value = entry.radar;
    artists.value = entry.artists;
    newAlbums.value = entry.albums;
  };

  /** 拉取首页推荐内容 */
  const load = async (): Promise<void> => {
    const platform = data.activePlatform;
    const loggedIn = data.isActivePlatformLoggedIn;
    if (
      cache &&
      cache.platform === platform &&
      cache.loggedIn === loggedIn &&
      Date.now() - cache.at < CACHE_TTL
    ) {
      apply(cache);
      return;
    }
    // 酷狗侧目前只有推荐歌单，其余区块留空，不做跨平台混排
    const [recommend, radar, artistList, albums] =
      platform === "kugou"
        ? [await safe("recommend playlists", fetchKugouRecommendPlaylists()), [], [], []]
        : await Promise.all([
            safe("recommend playlists", fetchRecommendPlaylists(user.isLoggedIn)),
            user.isLoggedIn
              ? safe("radar playlists", fetchRadarPlaylists())
              : Promise.resolve<CoverItem[]>([]),
            safe("artists", fetchArtists()),
            safe("new albums", fetchNewAlbums()),
          ]);
    cache = {
      at: Date.now(),
      platform,
      loggedIn,
      recommend,
      radar,
      artists: artistList,
      albums,
    };
    apply(cache);
  };

  // 平台或登录态变化
  watch(
    () => [data.activePlatform, data.isActivePlatformLoggedIn] as const,
    () => {
      void load();
    },
  );

  return {
    recommendPlaylists,
    recommendTitle,
    recommendSubtitle,
    radarPlaylists,
    artists,
    newAlbums,
    load,
  };
};
