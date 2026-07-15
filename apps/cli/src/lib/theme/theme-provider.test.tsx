import { test, expect, afterEach, beforeEach } from "bun:test";
import { useEffect } from "react";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testRender } from "@opentui/react/test-utils";
import { ThemeProvider, useTheme } from "./theme-provider.tsx";
import { loadThemeConfig } from "./theme-config.ts";

// The theming contract: previewing changes the rendered theme WITHOUT persisting;
// clearing the preview reverts to the committed theme (this is what an Escape-close
// of the picker does); committing changes the active theme AND persists it. Point
// XDG_CONFIG_HOME at a temp dir so commit's disk write is exercised, not the home.

let tmp: string;
const savedXdg = process.env.XDG_CONFIG_HOME;
let testSetup: Awaited<ReturnType<typeof testRender>>;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "nc-theme-provider-"));
  process.env.XDG_CONFIG_HOME = tmp;
});

afterEach(() => {
  testSetup?.renderer.destroy();
  if (savedXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = savedXdg;
  rmSync(tmp, { recursive: true, force: true });
});

/** Renders the resolved theme name and runs `steps` once on mount. */
function Probe({ steps }: { steps: (api: ReturnType<typeof useTheme>) => void }) {
  const api = useTheme();
  useEffect(() => {
    steps(api);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <text>{`theme=${api.theme.name} active=${api.activeThemeId}`}</text>;
}

async function mount(steps: (api: ReturnType<typeof useTheme>) => void) {
  testSetup = await testRender(
    <ThemeProvider>
      <Probe steps={steps} />
    </ThemeProvider>,
    { width: 60, height: 4 },
  );
  await testSetup.renderOnce();
  return testSetup;
}

test("defaults to the Default theme with no config", async () => {
  const { waitForFrame } = await mount(() => {});
  const frame = await waitForFrame((f) => f.includes("theme="));
  expect(frame).toContain("theme=Default active=default");
});

test("preview changes the rendered theme but NOT the active id (unpersisted)", async () => {
  const { waitForFrame } = await mount((api) => api.previewTheme("light"));
  const frame = await waitForFrame((f) => f.includes("theme=Light"));
  // Rendered theme flips to Light, but the committed/persisted id stays default.
  expect(frame).toContain("theme=Light active=default");
  expect(loadThemeConfig()).toBe("default"); // nothing written to disk
});

test("clearPreview reverts to the active theme (Escape-close behavior)", async () => {
  const { waitForFrame } = await mount((api) => {
    api.previewTheme("light");
    api.clearPreview();
  });
  const frame = await waitForFrame((f) => f.includes("theme="));
  expect(frame).toContain("theme=Default active=default");
});

test("commit sets the active theme and persists it", async () => {
  const { waitForFrame } = await mount((api) => api.commitTheme("light"));
  const frame = await waitForFrame((f) => f.includes("active=light"));
  expect(frame).toContain("theme=Light active=light");
  expect(loadThemeConfig()).toBe("light"); // written to disk
});
