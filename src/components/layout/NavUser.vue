<script setup lang="ts">
import { useUserStore } from "@/stores/user";
import { useDataStore } from "@/stores/data";
import { dialog } from "@/composables/useDialog";
import { toast } from "@/composables/useToast";
import { getPlatformAccountAdapter } from "@/apis/login/platform";
import vipImg from "@/assets/images/vip.png";
import IconLucideListMusic from "~icons/lucide/list-music";
import IconLucideDisc3 from "~icons/lucide/disc-3";
import IconLucideUserRound from "~icons/lucide/user-round";

const { t } = useI18n();
const router = useRouter();
const user = useUserStore();
const data = useDataStore();

const loginOpen = ref(false);
const popoverOpen = ref(false);

/** 当前平台是否已登录 */
const isLoggedIn = computed(() => data.isActivePlatformLoggedIn);

/** 当前生效的平台 */
const isNetease = computed(() => data.activePlatform === "netease");

/** 当前平台的展示资料，网易云沿用 user store 的完整资料 */
const displayProfile = computed(() => {
  const platform = data.activePlatform;
  if (platform === "netease") {
    return user.profile
      ? {
          nickname: user.profile.nickname,
          avatarUrl: user.profile.avatarUrl,
          isVip: !!user.profile.vipType && user.profile.vipType !== 0,
          signature: user.profile.signature,
        }
      : null;
  }
  const profile = data.getPlatformProfile(platform);
  return profile
    ? {
        nickname: profile.nickname,
        avatarUrl: profile.avatarUrl,
        isVip: profile.isVip,
        signature: undefined,
      }
    : null;
});

/** 启动、恢复窗口及可见期间校验凭据 */
onMounted(() => {
  void user.fetchStatus();
  void refreshPlatformProfile();
});
useEventListener(window, "focus", () => {
  if (user.isLoggedIn) void user.fetchStatus();
  void refreshPlatformProfile();
});
useIntervalFn(
  () => {
    if (document.visibilityState === "visible") {
      if (user.isLoggedIn) void user.fetchStatus(false);
      void refreshPlatformProfile();
    }
  },
  5 * 60 * 1000,
);

/**
 * 刷新当前平台的登录资料
 * 网易云由 user store 负责，其余平台查询各自接口后回写
 */
const refreshPlatformProfile = async (): Promise<void> => {
  const platform = data.activePlatform;
  if (platform === "netease") return;
  if (!data.getPlatformProfile(platform)) return;
  const latest = await getPlatformAccountAdapter(platform).fetchProfile();
  if (latest) {
    data.setPlatformProfile(platform, latest);
    if (platform === "kugou") void user.loadKugouContent();
  } else {
    data.clearPlatformProfile(platform);
  }
};

// 平台切换：清空上一平台的共享内容，再按新平台重新加载
watch(
  () => data.activePlatform,
  (platform) => {
    user.clearSharedContent();
    if (platform === "kugou" && data.getPlatformProfile("kugou")) void user.loadKugouContent();
  },
  { immediate: true },
);

/** 收藏计数，仅网易云有完整收藏数据 */
const stats = computed(() => [
  {
    key: "playlist" as const,
    label: t("collection.playlist"),
    icon: markRaw(IconLucideListMusic),
    value:
      (user.subcount.createdPlaylistCount || 0) + (user.subcount.subPlaylistCount || 0) ||
      user.playlists.length,
  },
  {
    key: "album" as const,
    label: t("collection.album"),
    icon: markRaw(IconLucideDisc3),
    value: user.albums.length,
  },
  {
    key: "artist" as const,
    label: t("artist.label"),
    icon: markRaw(IconLucideUserRound),
    value: user.subcount.artistCount ?? user.artists.length,
  },
]);

const onTriggerClick = (): void => {
  if (!isLoggedIn.value) loginOpen.value = true;
};

const handleStatClick = (key: "playlist" | "album" | "artist"): void => {
  popoverOpen.value = false;
  router.push({ path: "/favorites", query: { tab: key } });
};

const handleLogout = async (): Promise<void> => {
  popoverOpen.value = false;
  const ok = await dialog.confirm({
    title: t("login.logoutConfirmTitle"),
    content: t("login.logoutConfirmDesc"),
    type: "warning",
  });
  if (!ok) return;
  const platform = data.activePlatform;
  if (platform === "netease") {
    await user.logout();
  } else {
    await getPlatformAccountAdapter(platform).logout();
    data.clearPlatformProfile(platform);
  }
  toast.success(t("login.logoutDone"));
};
</script>

<template>
  <SPopover
    v-if="isLoggedIn"
    v-model:open="popoverOpen"
    trigger="click"
    align="end"
    content-class="w-40"
  >
    <template #trigger>
      <div
        class="app-no-drag inline-flex items-center gap-2 h-10 pl-1 pr-3 lt-sidebar:pr-1 rounded-full bg-on-surface/6 hover:bg-on-surface/10 transition-colors cursor-pointer select-none"
      >
        <span
          class="size-8 rounded-full overflow-hidden bg-on-surface/10 flex items-center justify-center"
        >
          <img
            v-if="displayProfile?.avatarUrl"
            :src="displayProfile.avatarUrl"
            alt="avatar"
            class="size-full object-cover"
            referrerpolicy="no-referrer"
          />
          <IconLucideUserRound v-else class="size-4 text-on-surface-variant" />
        </span>
        <span class="text-sm text-on-surface max-w-[7rem] truncate lt-sidebar:hidden">
          {{ displayProfile?.nickname || t("login.unknownUser") }}
        </span>
        <img
          v-if="displayProfile?.isVip && isNetease"
          :src="vipImg"
          alt="VIP"
          class="h-4 shrink-0 lt-sidebar:hidden"
        />
        <STag v-else-if="displayProfile?.isVip" size="small" round>VIP</STag>
        <IconLucideChevronDown
          :class="[
            'size-3 text-on-surface-variant transition-transform duration-200 lt-sidebar:hidden',
            popoverOpen && 'rotate-180',
          ]"
        />
      </div>
    </template>

    <div class="flex flex-col items-center gap-2">
      <span
        class="size-12 rounded-full overflow-hidden bg-on-surface/10 flex items-center justify-center"
      >
        <img
          v-if="displayProfile?.avatarUrl"
          :src="displayProfile.avatarUrl"
          alt="avatar"
          class="size-full object-cover"
          referrerpolicy="no-referrer"
        />
        <IconLucideUserRound v-else class="size-5 text-on-surface-variant" />
      </span>
      <span class="w-full text-sm font-semibold text-on-surface text-center truncate">
        {{ displayProfile?.nickname || t("login.unknownUser") }}
      </span>
      <div
        v-if="
          (data.activePlatform === 'netease' && user.level !== undefined) || displayProfile?.isVip
        "
        class="flex items-center gap-1.5"
      >
        <span
          v-if="data.activePlatform === 'netease' && user.level !== undefined"
          class="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none bg-amber-500/15 text-amber-600 dark:text-amber-400 tabular-nums"
        >
          Lv.{{ user.level }}
        </span>
        <img
          v-if="displayProfile?.isVip && isNetease"
          :src="vipImg"
          alt="VIP"
          class="h-4 shrink-0"
        />
        <STag v-else-if="displayProfile?.isVip" size="small" round>VIP</STag>
      </div>
      <span
        v-if="displayProfile?.signature"
        class="text-xs text-on-surface-variant text-center line-clamp-2"
      >
        {{ displayProfile?.signature }}
      </span>
      <SDivider class="w-full" />
      <!-- 收藏计数 -->
      <div class="w-full flex items-stretch justify-around gap-1">
        <div
          v-for="item in stats"
          :key="item.key"
          :title="item.label"
          class="group flex flex-1 flex-col items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors duration-200 hover:bg-on-surface/8 active:bg-on-surface/12"
          @click="handleStatClick(item.key)"
        >
          <component
            :is="item.icon"
            class="size-4 text-on-surface-variant/70 transition-colors duration-200 group-hover:text-primary"
          />
          <span
            class="text-sm font-semibold text-on-surface tabular-nums leading-none transition-colors duration-200 group-hover:text-primary"
          >
            {{ item.value }}
          </span>
        </div>
      </div>
      <SDivider class="w-full" />
      <SButton variant="secondary" size="small" block @click="handleLogout">
        <template #icon><IconLucideLogOut /></template>
        {{ t("login.logout") }}
      </SButton>
    </div>
  </SPopover>

  <SButton v-else class="app-no-drag" variant="tertiary" :size="40" circle @click="onTriggerClick">
    <template #icon><IconLucideUserRound /></template>
  </SButton>

  <LoginDialog v-model:open="loginOpen" />
</template>
