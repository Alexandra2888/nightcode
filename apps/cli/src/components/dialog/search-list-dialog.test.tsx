import { test, expect, afterEach } from "bun:test";
import { useEffect } from "react";
import { testRender } from "@opentui/react/test-utils";
import { LayerProvider } from "../../lib/layer.tsx";
import { ThemeProvider } from "../../lib/theme/index.ts";
import { DialogProvider, useDialog } from "./dialog.tsx";
import { SearchListDialog } from "./search-list-dialog.tsx";

// End-to-end search-list behavior through real keystrokes: the list filters as
// you type (via the input's per-keystroke onInput), arrows move the highlight and
// wrap, Enter chooses the highlighted row, and choosing closes the dialog.
//
// Keystrokes need a nonzero per-key delay so each routes through the real parse
// path (see chat-text-area.test.tsx for the same caveat).
const KEY_DELAY_MS = 5;

let testSetup: Awaited<ReturnType<typeof testRender>>;

afterEach(() => {
  testSetup?.renderer.destroy();
});

const FRUITS = ["apple", "apricot", "banana", "cherry"];

/** Opens the dialog on mount and records selections (and, optionally, highlights). */
function Harness({
  onSelect,
  onHighlight,
}: {
  onSelect: (value: string) => void;
  onHighlight?: (value: string) => void;
}) {
  const { openDialog } = useDialog();
  useEffect(() => {
    openDialog("fruits");
  }, [openDialog]);
  return (
    <SearchListDialog
      id="fruits"
      title="Fruits"
      items={FRUITS}
      toText={(f) => f}
      itemKey={(f) => f}
      renderItem={(f) => <text>{f}</text>}
      onSelect={onSelect}
      onHighlight={onHighlight}
    />
  );
}

async function mountDialog(
  onSelect: (value: string) => void = () => {},
  onHighlight?: (value: string) => void,
) {
  testSetup = await testRender(
    <ThemeProvider>
      <LayerProvider>
        <DialogProvider>
          <box height={24} width={80}>
            <Harness onSelect={onSelect} onHighlight={onHighlight} />
          </box>
        </DialogProvider>
      </LayerProvider>
    </ThemeProvider>,
    { width: 80, height: 24, kittyKeyboard: true },
  );
  await testSetup.renderOnce();
  return testSetup;
}

test("opens showing every item", async () => {
  const { waitForFrame } = await mountDialog();
  const frame = await waitForFrame((f) => f.includes("apple") && f.includes("cherry"));
  for (const fruit of FRUITS) expect(frame).toContain(fruit);
});

test("typing filters the list by substring", async () => {
  const { mockInput, waitForFrame } = await mountDialog();
  await waitForFrame((f) => f.includes("banana"));
  await mockInput.typeText("ap", KEY_DELAY_MS);
  const frame = await waitForFrame((f) => !f.includes("banana"));
  expect(frame).toContain("apple");
  expect(frame).toContain("apricot");
  expect(frame).not.toContain("banana");
  expect(frame).not.toContain("cherry");
});

test("Enter chooses the highlighted item and closes the dialog", async () => {
  const chosen: { value: string | null } = { value: null };
  const { mockInput, waitForFrame } = await mountDialog((v) => {
    chosen.value = v;
  });
  await waitForFrame((f) => f.includes("apple"));
  // Highlight starts on the first row; down moves to the second (apricot). Drive
  // the keys through pressKeys (delayed delivery) so each routes through the real
  // parse path in order — synchronous back-to-back presses race the parser.
  await mockInput.pressKeys(["ARROW_DOWN", "RETURN"], KEY_DELAY_MS);
  await waitForFrame((f) => !f.includes("Fruits")); // dialog closed on select
  expect(chosen.value).toBe("apricot");
});

test("onHighlight fires for the top row on open and follows the arrows", async () => {
  const highlights: string[] = [];
  const { mockInput, waitForFrame } = await mountDialog(
    () => {},
    (v) => highlights.push(v),
  );
  // Preview lands on the default highlight (row 0) as soon as the dialog opens.
  await waitForFrame(() => highlights.length > 0);
  expect(highlights[0]).toBe("apple");
  // Arrowing down previews the next row — commit (onSelect) hasn't run.
  await mockInput.pressKeys(["ARROW_DOWN"], KEY_DELAY_MS);
  await waitForFrame(() => highlights[highlights.length - 1] === "apricot");
  expect(highlights[highlights.length - 1]).toBe("apricot");
});

test("onHighlight follows a query filter (previews the new top match)", async () => {
  const highlights: string[] = [];
  const { mockInput, waitForFrame } = await mountDialog(
    () => {},
    (v) => highlights.push(v),
  );
  await waitForFrame(() => highlights.length > 0);
  // Typing "ch" filters to "cherry" and resets the highlight to row 0 → preview.
  await mockInput.typeText("ch", KEY_DELAY_MS);
  await waitForFrame(() => highlights[highlights.length - 1] === "cherry");
  expect(highlights[highlights.length - 1]).toBe("cherry");
});

test("arrow selection wraps past the top", async () => {
  const chosen: { value: string | null } = { value: null };
  const { mockInput, waitForFrame } = await mountDialog((v) => {
    chosen.value = v;
  });
  await waitForFrame((f) => f.includes("apple"));
  // From row 0, up wraps to the last row (cherry).
  await mockInput.pressKeys(["ARROW_UP", "RETURN"], KEY_DELAY_MS);
  await waitForFrame((f) => !f.includes("Fruits"));
  expect(chosen.value).toBe("cherry");
});
