import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { TEST_HOME } = vi.hoisted(() => ({
  TEST_HOME: `/tmp/ccpocket-gallery-test-home-${process.pid}`,
}));

vi.mock("node:os", async (importOriginal) => {
  const mod = await importOriginal<typeof import("node:os")>();
  return {
    ...mod,
    homedir: () => TEST_HOME,
  };
});

import { GalleryStore } from "./gallery-store.js";

describe("GalleryStore.addImage", () => {
  beforeEach(async () => {
    await rm(TEST_HOME, { recursive: true, force: true });
    await mkdir(TEST_HOME, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_HOME, { recursive: true, force: true });
  });

  it("matches project filters across Windows slash styles", async () => {
    const store = new GalleryStore();
    await store.init();
    const imageDir = join(TEST_HOME, ".ccpocket", "gallery", "images");
    await mkdir(imageDir, { recursive: true });
    await writeFile(join(imageDir, "a.png"), Buffer.from("89504e470d0a1a0a", "hex"));
    await writeFile(join(imageDir, "b.png"), Buffer.from("89504e470d0a1a0a", "hex"));

    (store as any).index = [
      {
        id: "img-a",
        filename: "a.png",
        mimeType: "image/png",
        projectPath: "E:\\code\\DIY_ESP32S3_WATCH",
        sessionId: "session-1",
        sourcePath: "E:\\code\\DIY_ESP32S3_WATCH\\a.png",
        addedAt: new Date().toISOString(),
        sizeBytes: 8,
      },
      {
        id: "img-b",
        filename: "b.png",
        mimeType: "image/png",
        projectPath: "E:/code/other-project",
        sessionId: "session-2",
        sourcePath: "E:/code/other-project/b.png",
        addedAt: new Date().toISOString(),
        sizeBytes: 8,
      },
    ];

    const items = store.list({ projectPath: "E:/code/DIY_ESP32S3_WATCH" });
    expect(items.map((i) => i.id)).toEqual(["img-a"]);
  });

  it("resolves leading-slash project-relative paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "ccpocket-gallery-project-"));
    try {
      const imageDir = join(root, "images");
      const imagePath = join(imageDir, "screenshots.png");
      await mkdir(imageDir, { recursive: true });
      await writeFile(imagePath, Buffer.from("89504e470d0a1a0a", "hex"));

      const store = new GalleryStore();
      await store.init();

      const meta = await store.addImage("/images/screenshots.png", root, "session-1");
      expect(meta).not.toBeNull();
      expect(meta?.sourcePath).toBe(imagePath);
      expect(meta?.mimeType).toBe("image/png");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
