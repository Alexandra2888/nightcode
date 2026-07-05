import { test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { ChatCommand } from "../../lib/chat-commands.ts";
import { CommandPopover } from "./command-popover.tsx";

// The palette's presentation: it lists command names + descriptions and its
// state (open/filter/selection) is owned by useCommandPopover, so here we just
// assert the rendered rows for a given list + highlight.

let testSetup: Awaited<ReturnType<typeof testRender>>;

afterEach(() => {
  testSetup?.renderer.destroy();
});

const noop = () => {};

// The palette pins itself with `bottom="100%"`, so in isolation it lands above
// the top of the screen. Mirror ChatTextArea's real layout — a bottom-anchored
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

const commands: ChatCommand[] = [
  { name: "/new", description: "Start a new session", execute: noop },
  { name: "/exit", description: "Exit nightcode", execute: noop },
];

test("renders every command's name and description", async () => {
  const frame = await frameFor(
    <CommandPopover
      commands={commands}
      selectedIndex={0}
      onHover={noop}
      onRun={noop}
    />,
  );
  expect(frame).toContain("/new");
  expect(frame).toContain("Start a new session");
  expect(frame).toContain("/exit");
  expect(frame).toContain("Exit nightcode");
});

test("floats the palette above the input, not below it", async () => {
  const frame = await frameFor(
    <CommandPopover
      commands={commands}
      selectedIndex={0}
      onHover={noop}
      onRun={noop}
    />,
  );
  const lines = frame.split("\n");
  const popoverRow = lines.findIndex((l) => l.includes("/new"));
  const inputRow = lines.findIndex((l) => l.includes("[ input ]"));
  expect(popoverRow).toBeGreaterThanOrEqual(0);
  expect(inputRow).toBeGreaterThan(popoverRow); // palette sits above the input
});

test("caps the viewport with a scrollbox when the list overflows", async () => {
  // 15 > MAX_VISIBLE_ROWS(10): the scrollbox branch renders (bounded height,
  // scrollbar) rather than a full column, so the palette can't grow unbounded.
  const many: ChatCommand[] = Array.from({ length: 15 }, (_, i) => ({
    name: `/cmd${i}`,
    description: `command number ${i}`,
    execute: noop,
  }));
  const frame = await frameFor(
    <CommandPopover
      commands={many}
      selectedIndex={0}
      onHover={noop}
      onRun={noop}
    />,
  );
  expect(frame).toContain("/cmd0"); // early rows render in the scrollbox
  expect(frame).not.toContain("/cmd14"); // far rows are past the capped viewport
});

test("renders an empty list without crashing", async () => {
  // filterCommands can return [] (no match); the popover shouldn't be shown then,
  // but rendering it must not throw (scrollbox height 0, no selected row).
  const frame = await frameFor(
    <CommandPopover
      commands={[]}
      selectedIndex={0}
      onHover={noop}
      onRun={noop}
    />,
  );
  expect(frame).not.toContain("/new");
});
