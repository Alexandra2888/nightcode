import { test, expect, afterEach } from "bun:test";
import { useEffect } from "react";
import { testRender } from "@opentui/react/test-utils";
import { LayerProvider } from "../../lib/layer.tsx";
import { ThemeProvider } from "../../lib/theme/index.ts";
import { Dialog, DialogProvider, useDialog } from "./dialog.tsx";

// The `Dialog` primitive registers a high-z layer while open, so Ctrl+C closes it
// (via `onClose`) instead of quitting the app, and does nothing while closed. We
// assert through a spy `onClose` rather than the dialog visually disappearing:
// closing unmounts the dialog, and the mock renderer doesn't flush an unmount
// triggered from within the unmounting subtree's own key handler (the same reason
// the suite tests Enter-select-close from outside the dialog). The spy proves the
// layer dispatch reached `onClose`, which is what closes the dialog in the app.
let testSetup: Awaited<ReturnType<typeof testRender>>;

afterEach(() => {
  testSetup?.renderer.destroy();
});

async function mount(open: boolean, onClose: () => void) {
  testSetup = await testRender(
    <ThemeProvider>
      <LayerProvider>
        <box height={24} width={80}>
          <Dialog open={open} title="Fruits" onClose={onClose}>
            <text>body</text>
          </Dialog>
        </box>
      </LayerProvider>
    </ThemeProvider>,
    // Mirror the app: Ctrl+C is routed by LayerProvider, not the built-in quit.
    { width: 80, height: 24, kittyKeyboard: true, exitOnCtrlC: false },
  );
  await testSetup.renderOnce();
  return testSetup;
}

test("Ctrl+C closes the open dialog instead of quitting the app", async () => {
  let closed = 0;
  const { mockInput, renderOnce, renderer } = await mount(true, () => {
    closed += 1;
  });

  let destroyed = 0;
  const realDestroy = renderer.destroy.bind(renderer);
  renderer.destroy = () => {
    destroyed += 1;
  };
  mockInput.pressCtrlC();
  await renderOnce();

  expect(closed).toBe(1); // the dialog layer claimed Ctrl+C and closed
  expect(destroyed).toBe(0); // so the app stayed alive
  renderer.destroy = realDestroy;
});

test("a closed dialog is not registered, so Ctrl+C falls through to quit", async () => {
  let closed = 0;
  const { mockInput, renderOnce, renderer } = await mount(false, () => {
    closed += 1;
  });

  let destroyed = 0;
  const realDestroy = renderer.destroy.bind(renderer);
  renderer.destroy = () => {
    destroyed += 1;
  };
  mockInput.pressCtrlC();
  await renderOnce();

  expect(closed).toBe(0); // closed dialog never registered its layer
  expect(destroyed).toBe(1); // nothing claimed Ctrl+C → app quits
  renderer.destroy = realDestroy;
});

// `useDialog(id)` is scoped: each caller sees `open` only for ITS id, plus a
// shared `anyOpen`. `openDialog(id)` activates exactly one dialog, so opening a
// second closes the first — the guarantee that opening `/theme` can't also open
// the sessions dialog.

/** Renders the scoped open-state of two ids plus anyOpen, running `steps`
 *  (openDialog/closeDialog calls) once on mount. */
function ScopeProbe({
  steps,
}: {
  steps: (api: ReturnType<typeof useDialog>) => void;
}) {
  const a = useDialog("a");
  const b = useDialog("b");
  useEffect(() => {
    steps(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <text>{`a=${a.open} b=${b.open} any=${a.anyOpen}`}</text>;
}

async function mountScope(steps: (api: ReturnType<typeof useDialog>) => void) {
  testSetup = await testRender(
    <DialogProvider>
      <ScopeProbe steps={steps} />
    </DialogProvider>,
    { width: 40, height: 4 },
  );
  await testSetup.renderOnce();
  return testSetup;
}

test("useDialog: nothing is open initially", async () => {
  const { waitForFrame } = await mountScope(() => {});
  const frame = await waitForFrame((f) => f.includes("a="));
  expect(frame).toContain("a=false b=false any=false");
});

test("useDialog: opening one id scopes open to that id and sets anyOpen", async () => {
  const { waitForFrame } = await mountScope((api) => api.openDialog("a"));
  const frame = await waitForFrame((f) => f.includes("a=true"));
  expect(frame).toContain("a=true b=false any=true");
});

test("useDialog: opening a second id closes the first (exactly one active)", async () => {
  const { waitForFrame } = await mountScope((api) => {
    api.openDialog("a");
    api.openDialog("b");
  });
  const frame = await waitForFrame((f) => f.includes("b=true"));
  expect(frame).toContain("a=false b=true any=true");
});

test("useDialog: closeDialog clears everything", async () => {
  const { waitForFrame } = await mountScope((api) => {
    api.openDialog("a");
    api.closeDialog();
  });
  const frame = await waitForFrame((f) => f.includes("any=false"));
  expect(frame).toContain("a=false b=false any=false");
});
