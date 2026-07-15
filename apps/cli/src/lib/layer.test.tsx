import { test, expect, afterEach } from "bun:test";
import { useState } from "react";
import { testRender } from "@opentui/react/test-utils";
import { useKeyboard } from "@opentui/react";
import { LayerProvider, useLayer, useLayerContext } from "./layer.tsx";

// The layer service is the Ctrl+C router: it dispatches Ctrl+C down a z-ordered
// stack (highest z first, first `onKey` returning true wins), falling back to
// `renderer.destroy()` when nobody claims it. These tests drive real Ctrl+C
// keystrokes through `mockInput` (kitty protocol, like the other CLI tests) and
// assert dispatch order, the quit fallback, the `enabled` gate, stale-closure
// freshness, and that `topLayer` is reactive (so the prompt bar can re-render).
const KEY_DELAY_MS = 5;

let testSetup: Awaited<ReturnType<typeof testRender>>;

afterEach(() => {
  testSetup?.renderer.destroy();
});

/** A layer that records each time its `onKey` fires and returns a fixed verdict. */
function ProbeLayer({
  id,
  z,
  claims,
  log,
  enabled = true,
}: {
  id: string;
  z: number;
  claims: boolean;
  log: (id: string) => void;
  enabled?: boolean;
}) {
  useLayer(id, {
    z,
    enabled,
    onKey: () => {
      log(id);
      return claims;
    },
  });
  return null;
}

/** Renders the reactive top-layer id so tests can assert re-renders via frames. */
function TopProbe() {
  const { topLayer } = useLayerContext();
  return <text>{`TOP:${topLayer ?? "none"}`}</text>;
}

test("dispatches Ctrl+C to the highest-z layer and stops there", async () => {
  const fired: string[] = [];
  testSetup = await testRender(
    <LayerProvider>
      <box>
        <ProbeLayer id="low" z={10} claims={false} log={(id) => fired.push(id)} />
        <ProbeLayer id="high" z={100} claims={true} log={(id) => fired.push(id)} />
      </box>
    </LayerProvider>,
    { width: 40, height: 10, kittyKeyboard: true },
  );
  await testSetup.renderOnce();

  testSetup.mockInput.pressCtrlC();
  await testSetup.renderOnce();

  // High-z claimed it first, so low-z never ran.
  expect(fired).toEqual(["high"]);
});

test("quits (renderer.destroy) when no layer claims Ctrl+C", async () => {
  const fired: string[] = [];
  testSetup = await testRender(
    <LayerProvider>
      <box>
        <ProbeLayer id="solo" z={10} claims={false} log={(id) => fired.push(id)} />
      </box>
    </LayerProvider>,
    { width: 40, height: 10, kittyKeyboard: true },
  );
  await testSetup.renderOnce();

  // Spy on destroy so the fallback quit is observable without tearing down the
  // renderer mid-test; restore it so afterEach still cleans up for real.
  const realDestroy = testSetup.renderer.destroy.bind(testSetup.renderer);
  let destroyed = 0;
  testSetup.renderer.destroy = () => {
    destroyed += 1;
  };

  testSetup.mockInput.pressCtrlC();
  await testSetup.renderOnce();

  expect(fired).toEqual(["solo"]); // it was asked, and declined
  expect(destroyed).toBe(1); // so the app quit
  testSetup.renderer.destroy = realDestroy;
});

test("only the enabled layer receives Ctrl+C, and topLayer is reactive", async () => {
  // A harness whose higher layer registers only after a keypress flips `on`, so we
  // can watch `topLayer` re-render and confirm the layer isn't dispatched to while
  // disabled. `stamp` mirrors a value that changes across renders — the layer's
  // onKey must read the LATEST one (stale-closure guard), not the mount-time value.
  const fired: string[] = [];
  function Harness() {
    const [on, setOn] = useState(false);
    const [stamp, setStamp] = useState(0);
    useKeyboard((key) => {
      if (key.name === "e") setOn(true);
      if (key.name === "s") setStamp((n) => n + 1);
    });
    return (
      <box>
        <TopProbe />
        <text>{`STAMP:${stamp}`}</text>
        <ProbeLayer id="base" z={10} claims={false} log={(id) => fired.push(id)} />
        <ProbeLayer
          id="over"
          z={100}
          enabled={on}
          claims={true}
          log={() => fired.push(`over@${stamp}`)}
        />
      </box>
    );
  }

  testSetup = await testRender(
    <LayerProvider>
      <Harness />
    </LayerProvider>,
    { width: 40, height: 10, kittyKeyboard: true },
  );
  const { mockInput, waitForFrame } = testSetup;
  await testSetup.renderOnce();

  // Disabled: only "base" is registered, so it's the reactive top.
  await waitForFrame((f) => f.includes("TOP:base"));

  // Enable the higher layer; topLayer re-renders to it (proves reactivity).
  await mockInput.pressKeys(["e"], KEY_DELAY_MS);
  await waitForFrame((f) => f.includes("TOP:over"));

  // Bump the stamp so the mount-time closure (stamp 0) is stale.
  await mockInput.pressKeys(["s"], KEY_DELAY_MS);
  await waitForFrame((f) => f.includes("STAMP:1"));

  testSetup.mockInput.pressCtrlC();
  await testSetup.renderOnce();

  // The enabled higher layer claimed it, reading the LATEST stamp (1, not 0), and
  // "base" never ran because "over" claimed first.
  expect(fired).toEqual(["over@1"]);
});
