import { useCallback } from "react";
import { useRenderer } from "@opentui/react";
import { useNavigate } from "react-router";
import {
  matchChatCommand,
  type ChatCommandContext,
} from "../lib/chat-commands.ts";

/**
 * Wires the chat-command registry to the live app capabilities. Usable in any
 * component under the OpenTUI React root (both the home and chat screens render
 * `ChatTextArea`, which calls this), so commands work everywhere without any
 * per-screen prop threading.
 *
 * Returns `executeChatCommand(input)`: runs the matching command and returns
 * `true`, or returns `false` when the input isn't a command (the caller then
 * submits it as a normal message).
 */
export function useChatCommands() {
  const renderer = useRenderer();
  const navigate = useNavigate();

  const executeChatCommand = useCallback(
    (input: string): boolean => {
      const command = matchChatCommand(input);
      if (!command) return false;
      const ctx: ChatCommandContext = {
        // Destroy the renderer to quit — never process.exit() (see AGENTS.md).
        exit: () => renderer.destroy(),
        navigate: (to) => navigate(to),
      };
      command.execute(ctx);
      return true;
    },
    [renderer, navigate],
  );

  return { executeChatCommand };
}
