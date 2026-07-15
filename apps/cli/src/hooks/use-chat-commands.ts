import { useCallback } from "react";
import { useRenderer } from "@opentui/react";
import { useNavigate } from "react-router";
import {
  matchChatCommand,
  type ChatCommandContext,
} from "../lib/chat-commands.ts";
import { useDialog } from "../components/dialog/dialog.tsx";
import { useToast } from "../lib/toast.tsx";

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
  const { openDialog } = useDialog();
  const toast = useToast();

  const executeChatCommand = useCallback(
    (input: string): boolean => {
      const command = matchChatCommand(input);
      if (!command) return false;
      const ctx: ChatCommandContext = {
        // Destroy the renderer to quit — never process.exit() (see AGENTS.md).
        exit: () => renderer.destroy(),
        navigate,
        openDialog,
        toast: (variant, message) => toast[variant](message),
      };
      command.execute(ctx);
      return true;
    },
    [renderer, navigate, openDialog, toast],
  );

  return { executeChatCommand };
}
