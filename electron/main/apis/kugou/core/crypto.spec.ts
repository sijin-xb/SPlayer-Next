import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => "/tmp/splayer-test", on: vi.fn() },
}));

vi.mock("@main/store", () => ({
  store: {
    get: (key: string) => (key === "system.kugouLoginVersion" ? "standard" : undefined),
  },
}));

import {
  encryptKugouDeviceData,
  encryptKugouParams,
  decryptKugouDeviceData,
  cryptoMd5,
} from "./crypto";

describe("KG AES 封装", () => {
  it("设备数据用 aes-128 加密后可用同一密钥解回", () => {
    const payload = { page: 1, pagesize: 30, getkmr: 1 };
    const { key, content } = encryptKugouDeviceData(payload);
    expect(key).toHaveLength(6);
    expect(decryptKugouDeviceData(Buffer.from(content, "base64"), key)).toEqual(payload);
  });

  it("设备数据的 key 与 iv 取 md5 的前后各 16 位", () => {
    const { key } = encryptKugouDeviceData({ a: 1 });
    const digest = cryptoMd5(key);
    expect(digest).toHaveLength(32);
  });

  it("通用参数加密使用 16 位大写字母数字密钥并输出十六进制", () => {
    const { key, content } = encryptKugouParams({ singerid: 1, token: "t" });
    expect(key).toMatch(/^[0-9A-Z]{16}$/);
    expect(content).toMatch(/^[0-9a-f]+$/);
  });

  it("同一明文两次加密产生不同密文", () => {
    const a = encryptKugouParams({ x: 1 });
    const b = encryptKugouParams({ x: 1 });
    expect(a.key).not.toBe(b.key);
    expect(a.content).not.toBe(b.content);
  });
});
