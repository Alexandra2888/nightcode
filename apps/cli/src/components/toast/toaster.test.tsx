import { test, expect, afterEach } from "bun:test";
import { useEffect } from "react";
import { testRender } from "@opentui/react/test-utils";
import { ThemeProvider } from "../../lib/theme/index.ts";
import {
  ToastProvider,
  useToast,
  type ToastVariant,
} from "../../lib/toast.tsx";
import { Toaster } from "./toaster.tsx";

// End-to-end toast behavior: firing a toast renders an accented card in the
// upper right, and it auto-dismisses after its duration with no interaction
// (no close button). A short duration keeps the dismiss assertions fast.
const SHORT_DURATION_MS = 40;

let testSetup: Awaited<ReturnType<typeof testRender>>;

afterEach(() => {
  testSetup?.renderer.destroy();
});

/** Fires one toast of the given variant on mount. */
function Harness({
  variant,
  message,
}: {
  variant: ToastVariant;
  message: string;
}) {
  const toast = useToast();
  useEffect(() => {
    toast[variant](message, { duration: SHORT_DURATION_MS });
  }, [toast, variant, message]);
  return null;
}

async function mountToaster(variant: ToastVariant, message: string) {
  testSetup = await testRender(
    <ThemeProvider>
      <ToastProvider>
        <box height={24} width={80}>
          <Harness variant={variant} message={message} />
          <Toaster />
        </box>
      </ToastProvider>
    </ThemeProvider>,
    { width: 80, height: 24 },
  );
  await testSetup.renderOnce();
  return testSetup;
}

test("a success toast shows its label and message", async () => {
  const { waitForFrame } = await mountToaster("success", "Saved successfully");
  const frame = await waitForFrame((f) => f.includes("Saved successfully"));
  expect(frame).toContain("Success");
  expect(frame).toContain("Saved successfully");
});

test("an error toast shows its label and message", async () => {
  const { waitForFrame } = await mountToaster("error", "Something went wrong");
  const frame = await waitForFrame((f) => f.includes("Something went wrong"));
  expect(frame).toContain("Error");
});

test("an info toast shows its label and message", async () => {
  const { waitForFrame } = await mountToaster("info", "Heads up");
  const frame = await waitForFrame((f) => f.includes("Heads up"));
  expect(frame).toContain("Info");
});

test("a toast auto-dismisses after its duration with no interaction", async () => {
  const { waitForFrame, flush, captureCharFrame } = await mountToaster(
    "info",
    "Ephemeral note",
  );
  await waitForFrame((f) => f.includes("Ephemeral note"));
  // No key press, no close button — the timer removes it on its own. waitForFrame
  // rides the render scheduler and can't advance a real-time setTimeout, so wait
  // the duration out for real, then flush the resulting re-render to a frame.
  await new Promise((resolve) => setTimeout(resolve, SHORT_DURATION_MS + 30));
  await flush();
  expect(captureCharFrame()).not.toContain("Ephemeral note");
});
