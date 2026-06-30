import { TextAttributes } from "@opentui/core";

/**
 * The home-screen prompt box: a bordered, focused text area with a placeholder
 * and a key hint, mirroring the input on Claude Code / Codex / OpenCode home
 * screens. The textarea is uncontrolled — it manages its own edit buffer.
 */
export function PromptInput() {
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
          placeholder="Ask nightcode anything…"
          height={3}
          wrapMode="word"
          focused
        />
      </box>
      <box paddingTop={1}>
        <text attributes={TextAttributes.DIM}>enter for newline · esc to exit</text>
      </box>
    </box>
  );
}
