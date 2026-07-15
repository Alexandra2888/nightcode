import { test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { FileMentionPopover } from "./file-mention-popover.tsx";

// The popover's presentation: it lists file paths and its state (open/filter/
// selection) is owned by useFileMentionPopover, so here we just assert the
// rendered rows for a given list + highlight. Mirrors command-popover.test.tsx.

let testSetup: Awaited<ReturnType<typeof testRender>>;

afterEach(() => {
  testSetup?.renderer.destroy();
});

const noop = () => {};

// The popover pins itself with `bottom="100%"`, so in isolation it lands above
// the top of the screen. Mirror ChatTextArea's layout — a bottom-anchored
// relative wrapper with an input below it — so the popover floats on-screen.
async function frameFor(node: React.ReactNode) {
  testSetup = await testRender(
    <box height={24} justifyContent="flex-end">
      <box position="relative" overflow="visible">
        {node}
        <box height={4}>
          <text>[ input ]</text>
        </box>
      </box>
    </box>,
    { width: 80, height: 24 },
  );
  await testSetup.renderOnce();
  return testSetup.captureCharFrame();
}

const files = ["apps/cli/src/app.tsx", "packages/ai/src/index.ts"];

test("renders every file path", async () => {
  const frame = await frameFor(
    <FileMentionPopover
      files={files}
      selectedIndex={0}
      onHover={noop}
      onPick={noop}
    />,
  );
  expect(frame).toContain("apps/cli/src/app.tsx");
  expect(frame).toContain("packages/ai/src/index.ts");
});

test("floats the popover above the input, not below it", async () => {
  const frame = await frameFor(
    <FileMentionPopover
      files={files}
      selectedIndex={0}
      onHover={noop}
      onPick={noop}
    />,
  );
  const lines = frame.split("\n");
  const popoverRow = lines.findIndex((l) => l.includes("app.tsx"));
  const inputRow = lines.findIndex((l) => l.includes("[ input ]"));
  expect(popoverRow).toBeGreaterThanOrEqual(0);
  expect(inputRow).toBeGreaterThan(popoverRow); // popover sits above the input
});

test("caps the viewport with a scrollbox when the list overflows", async () => {
  // 15 > MAX_VISIBLE_ROWS(10): the scrollbox branch renders (bounded height,
  // scrollbar) rather than a full column, so the popover can't grow unbounded.
  const many = Array.from({ length: 15 }, (_, i) => `src/file-${i}.ts`);
  const frame = await frameFor(
    <FileMentionPopover
      files={many}
      selectedIndex={0}
      onHover={noop}
      onPick={noop}
    />,
  );
  expect(frame).toContain("src/file-0.ts"); // early rows render in the scrollbox
  expect(frame).not.toContain("src/file-14.ts"); // far rows are past the viewport
});

test("renders an empty list without crashing", async () => {
  const frame = await frameFor(
    <FileMentionPopover
      files={[]}
      selectedIndex={0}
      onHover={noop}
      onPick={noop}
    />,
  );
  expect(frame).not.toContain("app.tsx");
});
