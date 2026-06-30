import { useRef } from "react";
import type { TextareaRenderable } from "@opentui/core";

type PromptInputProps = {
  /** Called with the textarea's plain text when the user submits (Enter). */
  onSubmit?: (value: string) => void;
};

/**
 * The home-screen prompt box: a bordered, focused text area. The textarea is
 * uncontrolled (it owns its edit buffer); on submit we read its `plainText` via
 * a ref and hand it to the parent — this is the OpenTUI-native way to capture
 * input. Hints are left to the consuming screen.
 */
export function PromptInput({ onSubmit }: PromptInputProps) {
  const ref = useRef<TextareaRenderable>(null);

  return (
    <box flexDirection="column" alignItems="center" width={60}>
      <box
        border
        borderStyle="rounded"
        paddingLeft={1}
        paddingRight={1}
        width="100%"
      >
        <textarea
          ref={ref}
          placeholder="Type a screen, then Enter…"
          height={3}
          wrapMode="word"
          focused
          keyBindings={[
            { name: "return", action: "submit" },
            { name: "return", shift: true, action: "newline" },
          ]}
          onSubmit={() => onSubmit?.(ref.current?.plainText ?? "")}
        />
      </box>
    </box>
  );
}
