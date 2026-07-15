import { useCallback } from "react";
import { useRenderer } from "@opentui/react";
import { useNavigate } from "react-router";
import {
  matchChatCommand,
  type ChatCommandContext,
} from "../lib/chat-commands.ts";
import { useDialog } from "../components/dialog/dialog.tsx";
import { useToast } from "../lib/toast.tsx";
import { runLogin } from "../lib/auth/login.ts";
import { runLogout } from "../lib/auth/logout.ts";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
        // Sign-in is async but `execute` is synchronous and un-awaited (the
        // palette closes before it runs), so fire-and-forget and report the
        // outcome purely through toasts.
        login: () => {
          toast.info("Opening your browser to sign in…");
          runLogin()
            .then(() => toast.success("Signed in"))
            .catch((error: unknown) =>
              toast.error(`Sign-in failed: ${errorMessage(error)}`),
            );
        },
        logout: () => {
          runLogout()
            .then(({ revokeFailed }) =>
              revokeFailed
                ? toast.info("Signed out locally (couldn't revoke the token)")
                : toast.success("Signed out"),
            )
            .catch((error: unknown) =>
              toast.error(`Sign-out failed: ${errorMessage(error)}`),
            );
        },
      };
      command.execute(ctx);
      return true;
    },
    [renderer, navigate, openDialog, toast],
  );

  return { executeChatCommand };
}
