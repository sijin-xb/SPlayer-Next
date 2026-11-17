import type { Track } from "@shared/types/player";
import type { ContentScope } from "@/types/collection";
import { isPlatform } from "@shared/types/platform";
import { useUserStore } from "@/stores/user";
import { useSettingsStore } from "@/stores/settings";
import { toast } from "@/composables/useToast";

/**
 * 添加到歌单选择器
 * 在线歌曲未登录时拦截并提示，不打开弹窗
 */
export const usePlaylistPicker = () => {
  const user = useUserStore();
  const settings = useSettingsStore();
  const { t } = useI18n();

  /**
   * 当前在线平台是否已登录
   * @returns 网易云看登录态，其余平台看是否已载入歌单
   */
  const isOnlineLoggedIn = (): boolean =>
    settings.system.system.onlinePlatform === "netease"
      ? user.isLoggedIn
      : user.playlists.length > 0;

  /** 弹窗开关 */
  const open = ref(false);
  /** 待添加曲目 */
  const tracks = shallowRef<Track[]>([]);
  /** 本地 / 在线 */
  const mode = ref<ContentScope>("local");

  /**
   * 打开添加到歌单弹窗
   * @param items - 待添加曲目，需同源（local 或 netease）
   */
  const openPicker = (items: Track[]): void => {
    if (items.length === 0) return;
    const scope: ContentScope = isPlatform(items[0].source) ? "online" : "local";
    if (scope === "online" && !isOnlineLoggedIn()) {
      toast.warning(t("liked.toast.needLogin"));
      return;
    }
    tracks.value = items;
    mode.value = scope;
    open.value = true;
  };

  return { open, tracks, mode, openPicker };
};
