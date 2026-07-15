import { test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { MemoryRouter, useLocation } from "react-router";
import { ChatConfigProvider } from "../../lib/chat-config.tsx";
import { LayerProvider } from "../../lib/layer.tsx";
import { ToastProvider } from "../../lib/toast.tsx";
import { ThemeProvider } from "../../lib/theme/index.ts";
import { DialogProvider } from "../dialog/dialog.tsx";
import { ChatTextArea } from "./chat-text-area.tsx";

// End-to-end palette behavior driven through real keystrokes: typing "/" opens
// the palette, keywords filter it, Enter runs the highlighted command (here
// `/new`, which navigates home), and Escape closes it without navigating.
//
// The palette opens via a React state update from the textarea's onContentChange,
// so assertions use `waitForFrame` (polls until the frame settles) rather than a
// single `flush` + capture, which can race the re-render/paint.
//
// `typeText` MUST be called with a nonzero per-key delay: the default writes all
// bytes in one chunk, which the mock parser delivers without the per-keystroke
// content-change/keypress events real typing produces (so the palette wouldn't
// open). A small delay routes each key through the real parse path.
const KEY_DELAY_MS = 5;

let testSetup: Awaited<ReturnType<typeof testRender>>;

afterEach(() => {
  testSetup?.renderer.destroy();
});

/** Prints the router pathname so tests can assert navigation from a command. */
function LocationProbe() {
  const location = useLocation();
  return <text>{`PATH:${location.pathname}`}</text>;
}

/** Mounts ChatTextArea with its real providers, anchored near the bottom so the
 *  `bottom="100%"` palette floats on-screen above it (as it does in the app).
 *  `onSubmit` defaults to a no-op; pass a spy to assert (non-)submission. */
async function mountTextArea(onSubmit: (value: string) => void = () => {}) {
  testSetup = await testRender(
    <ThemeProvider>
      <LayerProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={["/sessions/abc"]}>
            <ChatConfigProvider>
              <DialogProvider>
                <box height={24} flexDirection="column">
                  <LocationProbe />
                  <box flexGrow={1} />
                  <ChatTextArea onSubmit={onSubmit} placeholder="type…" />
                </box>
              </DialogProvider>
            </ChatConfigProvider>
          </MemoryRouter>
        </ToastProvider>
      </LayerProvider>
    </ThemeProvider>,
    // `exitOnCtrlC: false` mirrors the app (`index.tsx`) so Ctrl+C is routed by
    // `LayerProvider`, not swallowed by the renderer's built-in quit.
    { width: 80, height: 24, kittyKeyboard: true, exitOnCtrlC: false },
  );
  await testSetup.renderOnce();
  return testSetup;
}

test("typing / opens the palette with all commands", async () => {
  const { mockInput, waitForFrame } = await mountTextArea();
  await mockInput.typeText("/", KEY_DELAY_MS);
  const frame = await waitForFrame(
    (f) => f.includes("/new") && f.includes("/exit"),
  );
  expect(frame).toContain("/new");
  expect(frame).toContain("/exit");
});

test("a keyword filters the palette", async () => {
  const { mockInput, waitForFrame } = await mountTextArea();
  await mockInput.typeText("/ex", KEY_DELAY_MS);
  const frame = await waitForFrame(
    (f) => f.includes("/exit") && !f.includes("/new"),
  );
  expect(frame).toContain("/exit");
  expect(frame).not.toContain("/new");
});

test("Enter runs the highlighted command (/new navigates home)", async () => {
  const { mockInput, waitForFrame } = await mountTextArea();
  await mockInput.typeText("/new", KEY_DELAY_MS);
  await waitForFrame((f) => f.includes("/new")); // palette open
  mockInput.pressEnter();
  // /new → navigate("/"): the probe flips from /sessions/abc to /.
  const frame = await waitForFrame((f) => !f.includes("PATH:/sessions/abc"));
  expect(frame).toContain("PATH:/");
  expect(frame).not.toContain("PATH:/sessions/abc");
});

test("Escape closes the palette without navigating", async () => {
  const { mockInput, waitForFrame } = await mountTextArea();
  await mockInput.typeText("/", KEY_DELAY_MS);
  await waitForFrame((f) => f.includes("/exit")); // open

  mockInput.pressEscape();
  const frame = await waitForFrame((f) => !f.includes("/exit")); // closed
  expect(frame).not.toContain("/exit");
  expect(frame).toContain("PATH:/sessions/abc"); // did not navigate
});

test("typing @ opens the file-mention popover, filtered by path", async () => {
  const { mockInput, waitForFrame } = await mountTextArea();
  // The workspace walk (from the repo root) contains exactly this hook path.
  await mockInput.typeText("@use-file-mention", KEY_DELAY_MS);
  const frame = await waitForFrame((f) =>
    f.includes("use-file-mention-popover.ts"),
  );
  expect(frame).toContain("apps/cli/src/hooks/use-file-mention-popover.ts");
});

test("Enter inserts the highlighted path and does NOT submit", async () => {
  let submitted: string | null = null;
  const { mockInput, waitForFrame } = await mountTextArea((value) => {
    submitted = value;
  });
  await mockInput.typeText("@use-file-mention", KEY_DELAY_MS);
  await waitForFrame((f) => f.includes("use-file-mention-popover.ts")); // open

  mockInput.pressEnter();
  // The buffer now holds the spliced path; the message was not sent.
  const frame = await waitForFrame((f) =>
    f.includes("@apps/cli/src/hooks/use-file-mention-popover.ts"),
  );
  expect(frame).toContain("@apps/cli/src/hooks/use-file-mention-popover.ts");
  expect(submitted).toBeNull(); // Enter inserted, it did not submit
});

test("@ inside an email does not open the popover", async () => {
  const { mockInput, waitForFrame, renderOnce } = await mountTextArea();
  await mockInput.typeText("mail@domain", KEY_DELAY_MS);
  await waitForFrame((f) => f.includes("mail@domain")); // text is in the buffer
  await renderOnce();
  const frame = testSetup.captureCharFrame();
  // No file rows — the '@' followed a word char, so it's not a mention.
  expect(frame).not.toContain("use-file-mention-popover.ts");
  expect(frame).not.toContain(".tsx");
});

test("Ctrl+C clears a non-empty buffer without quitting", async () => {
  const { mockInput, waitForFrame, renderer } = await mountTextArea();
  await mockInput.typeText("hello", KEY_DELAY_MS);
  await waitForFrame((f) => f.includes("hello"));

  let destroyed = 0;
  const realDestroy = renderer.destroy.bind(renderer);
  renderer.destroy = () => {
    destroyed += 1;
  };
  mockInput.pressCtrlC();
  const frame = await waitForFrame((f) => !f.includes("hello")); // buffer cleared
  expect(frame).not.toContain("hello");
  expect(destroyed).toBe(0); // clear claimed Ctrl+C — app stays alive
  renderer.destroy = realDestroy;
});

test("Ctrl+C on an empty buffer quits the app", async () => {
  const { mockInput, renderOnce, renderer } = await mountTextArea();

  let destroyed = 0;
  const realDestroy = renderer.destroy.bind(renderer);
  renderer.destroy = () => {
    destroyed += 1;
  };
  mockInput.pressCtrlC();
  await renderOnce();
  expect(destroyed).toBe(1); // nothing to clear → fall through → quit
  renderer.destroy = realDestroy;
});
