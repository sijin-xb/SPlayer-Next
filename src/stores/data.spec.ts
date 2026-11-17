import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cache = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<unknown>>(async () => null),
  setItem: vi.fn<(key: string, value: unknown) => Promise<void>>(async () => undefined),
}));

vi.mock("localforage", () => ({
  default: { createInstance: () => cache },
}));

vi.mock("@/apis/recommend/netease", () => ({
  fetchDailySongs: vi.fn(async () => [{ id: "ncm-1", title: "网易云曲目" }]),
}));

vi.mock("@/apis/recommend/kugou", () => ({
  fetchKugouDailySongs: vi.fn(async () => [{ id: "kg-1", title: "酷狗曲目" }]),
}));

import { fetchDailySongs } from "@/apis/recommend/netease";
import { fetchKugouDailySongs } from "@/apis/recommend/kugou";
import { useDataStore } from "./data";
import { useSettingsStore } from "./settings";
import { useUserStore } from "./user";

describe("每日推荐的平台分派", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    cache.getItem.mockReset().mockResolvedValue(null);
    cache.setItem.mockClear();
    vi.mocked(fetchDailySongs).mockClear();
    vi.mocked(fetchKugouDailySongs).mockClear();
    Object.defineProperty(window, "api", {
      configurable: true,
      value: {
        apis: { call: vi.fn(), clearSession: vi.fn() },
        config: { getAll: vi.fn(async () => ({})), set: vi.fn(async () => undefined) },
        desktopLyric: { onConfigChange: vi.fn(() => () => undefined) },
        dynamicIsland: { onConfigChange: vi.fn(() => () => undefined) },
        player: { setFadeDuration: vi.fn(async () => undefined) },
        window: {
          onDesktopLyricVisibilityChange: vi.fn(() => () => undefined),
          onDynamicIslandVisibilityChange: vi.fn(() => () => undefined),
          onTaskbarLyricVisibilityChange: vi.fn(() => () => undefined),
          isDesktopLyricOpen: vi.fn(async () => false),
          isDynamicIslandOpen: vi.fn(async () => false),
          isTaskbarLyricOpen: vi.fn(async () => false),
        },
      },
    });
    useSettingsStore().system.system.onlinePlatform = "netease";
  });

  it("未登录时不发请求", async () => {
    const store = useDataStore();
    expect(await store.ensureDailyRecommend()).toEqual([]);
    expect(fetchDailySongs).not.toHaveBeenCalled();
    expect(fetchKugouDailySongs).not.toHaveBeenCalled();
  });

  it("网易云登录后走网易云接口", async () => {
    const user = useUserStore();
    user.profile = { userId: 42, nickname: "ncm" };
    const store = useDataStore();
    const tracks = await store.ensureDailyRecommend(true);
    expect(fetchDailySongs).toHaveBeenCalled();
    expect(fetchKugouDailySongs).not.toHaveBeenCalled();
    expect(tracks[0]?.id).toBe("ncm-1");
  });

  it("酷狗登录且当前平台为 kugou 时走酷狗接口", async () => {
    useSettingsStore().system.system.onlinePlatform = "kugou";
    const store = useDataStore();
    store.setPlatformProfile("kugou", {
      userId: "kg-user-1",
      nickname: "kg",
      avatarUrl: "",
      isVip: false,
    });
    const tracks = await store.ensureDailyRecommend(true);
    expect(fetchKugouDailySongs).toHaveBeenCalled();
    expect(fetchDailySongs).not.toHaveBeenCalled();
    expect(tracks[0]?.id).toBe("kg-1");
  });

  it("当前平台为 kugou 但只在网易云登录时返回空", async () => {
    useSettingsStore().system.system.onlinePlatform = "kugou";
    const user = useUserStore();
    user.profile = { userId: 42, nickname: "ncm" };
    const store = useDataStore();
    expect(await store.ensureDailyRecommend(true)).toEqual([]);
    expect(fetchKugouDailySongs).not.toHaveBeenCalled();
  });

  it("缓存 key 带平台前缀，切换平台不读到对方归档", async () => {
    const user = useUserStore();
    user.profile = { userId: 7, nickname: "ncm" };
    useSettingsStore().system.system.onlinePlatform = "netease";
    const store = useDataStore();
    await store.ensureDailyRecommend(true);
    expect(cache.setItem).toHaveBeenCalledWith(
      "daily-recommend-archive:netease:7",
      expect.anything(),
    );

    store.setPlatformProfile("kugou", {
      userId: "kg-9",
      nickname: "kg",
      avatarUrl: "",
      isVip: false,
    });
    useSettingsStore().system.system.onlinePlatform = "kugou";
    await store.ensureDailyRecommend(true);
    expect(cache.setItem).toHaveBeenCalledWith(
      "daily-recommend-archive:kugou:kg-9",
      expect.anything(),
    );
  });
});
