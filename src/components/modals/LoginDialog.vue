<script setup lang="ts">
import { useUserStore } from "@/stores/user";
import { useDataStore } from "@/stores/data";
import { useSettingsStore } from "@/stores/settings";
import { toast } from "@/composables/useToast";
import { dialog } from "@/composables/useDialog";
import { REPO_NAME } from "@/utils/config";
import { getPlatformAccountAdapter } from "@/apis/login/platform";
import { syncNeteaseDeviceName } from "@/apis/login/netease";
import { ALL_PLATFORMS, type Platform } from "@shared/types/platform";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
const { t } = useI18n();
const user = useUserStore();
const dataStore = useDataStore();
const settingsStore = useSettingsStore();
const panelRef = useTemplateRef("panelRef");
const loading = ref(false);
const cookieDialogOpen = ref(false);

const platform = ref<Platform>(dataStore.activePlatform());
const adapter = computed(() => getPlatformAccountAdapter(platform.value).qrLogin!);
const platformName = computed(() => getPlatformAccountAdapter(platform.value).displayName);

watch(
  () => props.open,
  (open) => {
    if (open) platform.value = dataStore.activePlatform();
  },
);

const switchPlatform = (next: Platform): void => {
  if (next === platform.value) return;
  platform.value = next;
  panelRef.value?.refresh();
};

/** 平台切换标签 */
const platformTabs = ALL_PLATFORMS.map((item) => ({
  key: item,
  label: getPlatformAccountAdapter(item).displayName,
}));

const syncNeteaseProfile = async (): Promise<boolean> => {
  const ok = await user.fetchStatus();
  if (!ok) return false;
  const latest = await getPlatformAccountAdapter("netease").fetchProfile();
  if (latest) dataStore.setPlatformProfile("netease", latest);
  return true;
};

const finishLogin = async (): Promise<boolean> => {
  const target = platform.value;
  if (target === "netease") {
    if (!(await syncNeteaseProfile())) {
      toast.error(t("login.failed"));
      return false;
    }
  } else {
    const latest = await getPlatformAccountAdapter(target).fetchProfile();
    if (!latest) {
      toast.error(t("login.failed"));
      return false;
    }
    dataStore.setPlatformProfile(target, latest);
    if (target === "kugou") void user.loadKugouContent();
  }
  toast.success(t("login.success"));
  emit("update:open", false);
  return true;
};

const handleQrSuccess = async (): Promise<void> => {
  loading.value = true;
  try {
    if (!(await finishLogin())) void panelRef.value?.refresh();
  } finally {
    loading.value = false;
  }
};

const startAutoFetch = async (): Promise<void> => {
  if (loading.value) return;
  const ok = await dialog.confirm({
    title: t("login.autoFetchTitle"),
    content: t("login.autoFetchTip"),
    confirmText: t("login.autoFetchConfirm"),
    type: "warning",
  });
  if (!ok) return;
  loading.value = true;
  panelRef.value?.pause();
  try {
    const result = await window.api.apis.openLoginWeb(platform.value);
    if (!result.ok) {
      if (result.error !== "canceled") toast.error(t("login.failed"));
      panelRef.value?.resume();
      return;
    }
    if (!(await finishLogin())) void panelRef.value?.refresh();
    else if (platform.value === "netease") void syncNeteaseDeviceName();
  } finally {
    loading.value = false;
  }
};

const setAsActive = async (): Promise<void> => {
  await settingsStore.setSystem("system.onlinePlatform", platform.value);
};

const openManualCookie = (): void => {
  panelRef.value?.pause();
  cookieDialogOpen.value = true;
};

const onCookieDialogOpen = (open: boolean): void => {
  cookieDialogOpen.value = open;
  if (!open && props.open) panelRef.value?.resume();
};
</script>

<template>
  <SDialog :open="open" :closable="false" width="380px" @update:open="emit('update:open', $event)">
    <div class="flex flex-col items-center gap-4 py-3">
      <div class="flex flex-col items-center gap-2">
        <SLogo :size="48" />
        <div class="text-xl font-semibold text-on-surface">{{ REPO_NAME }}</div>
      </div>
      <STabs
        :model-value="platform"
        :tabs="platformTabs"
        type="segment"
        size="small"
        round
        @update:model-value="switchPlatform($event as Platform)"
      />
      <div class="text-xs text-on-surface-variant/60">
        {{ t("login.platformHint", { name: platformName }) }}
      </div>
      <QrLoginPanel
        ref="panelRef"
        class="mt-1"
        :active="open"
        :adapter="adapter"
        @success="handleQrSuccess"
      />
      <div class="flex items-center gap-2 pt-1">
        <SButton variant="ghost" size="small" :disabled="loading" @click="startAutoFetch">
          <template #icon><IconLucideScanLine /></template>
          {{ t("login.autoFetch") }}
        </SButton>
        <div class="h-3 w-px bg-outline-variant/40" />
        <SButton variant="ghost" size="small" :disabled="loading" @click="openManualCookie">
          <template #icon><IconLucideKeyRound /></template>
          {{ t("login.manualCookie") }}
        </SButton>
      </div>
    </div>
    <template #footer="{ close }">
      <div class="flex items-center justify-center gap-2">
        <SButton
          v-if="platform !== dataStore.activePlatform()"
          variant="secondary"
          :disabled="loading"
          @click="setAsActive"
        >
          {{ t("login.useThisPlatform", { name: platformName }) }}
        </SButton>
        <SButton variant="tertiary" :disabled="loading" @click="close">
          <template #icon><IconLucideX /></template>
          {{ t("common.cancel") }}
        </SButton>
      </div>
    </template>
  </SDialog>
  <LoginCookieDialog
    :open="cookieDialogOpen"
    @update:open="onCookieDialogOpen"
    @success="emit('update:open', false)"
  />
</template>
