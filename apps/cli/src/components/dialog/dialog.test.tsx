import { test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { LayerProvider } from "../../lib/layer.tsx";
import { Dialog } from "./dialog.tsx";

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
    <LayerProvider>
      <box height={24} width={80}>
        <Dialog open={open} title="Fruits" onClose={onClose}>
          <text>body</text>
        </Dialog>
      </box>
    </LayerProvider>,
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
