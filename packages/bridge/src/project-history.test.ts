import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { ProjectHistory } from "./project-history.js";

let tempDir: string;
let historyFile: string;

beforeEach(async () => {
  tempDir = join(tmpdir(), `ph-test-${randomUUID().slice(0, 8)}`);
  await mkdir(tempDir, { recursive: true });
  historyFile = join(tempDir, "project-history.json");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("ProjectHistory", () => {
  it("init creates directory and starts with empty projects", async () => {
    const ph = new ProjectHistory(historyFile);
    await ph.init();
    expect(ph.getProjects()).toEqual([]);
  });

  it("addProject adds a project to the front", async () => {
    const ph = new ProjectHistory(historyFile);
    await ph.init();
    ph.addProject("/Users/test/project-a");
    ph.addProject("/Users/test/project-b");
    expect(ph.getProjects()).toEqual(["/Users/test/project-b", "/Users/test/project-a"]);
  });

  it("addProject moves existing project to front", async () => {
    const ph = new ProjectHistory(historyFile);
    await ph.init();
    ph.addProject("/Users/test/project-a");
    ph.addProject("/Users/test/project-b");
    ph.addProject("/Users/test/project-a");
    expect(ph.getProjects()).toEqual(["/Users/test/project-a", "/Users/test/project-b"]);
  });

  it("addProject enforces max 20 projects", async () => {
    const ph = new ProjectHistory(historyFile);
    await ph.init();
    for (let i = 0; i < 25; i++) {
      ph.addProject(`/Users/test/project-${i}`);
    }
    const projects = ph.getProjects();
    expect(projects.length).toBe(20);
    // Most recent should be first
    expect(projects[0]).toBe("/Users/test/project-24");
    expect(projects[19]).toBe("/Users/test/project-5");
  });

  it("removeProject removes a project", async () => {
    const ph = new ProjectHistory(historyFile);
    await ph.init();
    ph.addProject("/Users/test/project-a");
    ph.addProject("/Users/test/project-b");
    ph.removeProject("/Users/test/project-a");
    expect(ph.getProjects()).toEqual(["/Users/test/project-b"]);
  });

  it("removeProject is a no-op for non-existent path", async () => {
    const ph = new ProjectHistory(historyFile);
    await ph.init();
    ph.addProject("/Users/test/project-a");
    ph.removeProject("/Users/test/nonexistent");
    expect(ph.getProjects()).toEqual(["/Users/test/project-a"]);
  });

  it("getProjects returns a copy (not a reference)", async () => {
    const ph = new ProjectHistory(historyFile);
    await ph.init();
    ph.addProject("/Users/test/project-a");
    const projects = ph.getProjects();
    projects.push("/Users/test/mutated");
    expect(ph.getProjects()).toEqual(["/Users/test/project-a"]);
  });

  it("rejects invalid project paths", async () => {
    const ph = new ProjectHistory(historyFile);
    await ph.init();
    ph.addProject("relative/path/project"); // not absolute
    ph.addProject(""); // empty
    ph.addProject("E:\\bad"); // too shallow on Windows
    ph.addProject("/Users/test/valid-project"); // valid
    expect(ph.getProjects()).toEqual(["/Users/test/valid-project"]);
  });

  it("accepts valid Windows absolute project paths", async () => {
    const ph = new ProjectHistory(historyFile);
    await ph.init();
    ph.addProject("E:\\code\\DIY_ESP32S3_WATCH");
    expect(ph.getProjects()).toEqual(["E:\\code\\DIY_ESP32S3_WATCH"]);
  });

  it("filters out invalid Windows paths on init", async () => {
    await writeFile(
      historyFile,
      JSON.stringify(["E:\\code\\DIY_ESP32S3_WATCH", "relative\\path", "E:\\bad"]),
      "utf-8",
    );
    const ph = new ProjectHistory(historyFile);
    await ph.init();
    expect(ph.getProjects()).toEqual(["E:\\code\\DIY_ESP32S3_WATCH"]);
  });

  it("handles corrupt file gracefully", async () => {
    await writeFile(historyFile, "not valid json", "utf-8");

    const ph = new ProjectHistory(historyFile);
    await ph.init();
    expect(ph.getProjects()).toEqual([]);
  });
});
