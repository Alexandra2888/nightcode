import { createContext, useContext, useState, type ReactNode } from "react";
import {
  DEFAULT_MODE,
  cycleMode,
  defaultCodingAgentModelId,
  type ModeName,
  type CodingAgentModelId,
} from "nightcode-ai/client";

/**
 * Cross-route chat UI state. The active mode has to be readable and writable
 * from the home screen (pick a mode before the first message), the chat screen
 * (thread it through the transport so it governs each request), and the shared
 * text-area beneath both (render the indicator + own the Tab keypress). That's
 * not router state — router state carries the session id + opening prompt — it's
 * a provider wrapping both screens so the value survives navigation and there's
 * one source of truth, no per-screen snapshotting.
 */
type ChatConfig = {
  /** The active behaviour mode. */
  mode: ModeName;
  /** Set the mode directly. */
  setMode: (mode: ModeName) => void;
  /** Advance to the next mode (+1) / previous (-1), cycling across all modes. */
  cycle: (dir: 1 | -1) => void;
  /** The active coding-agent model (chosen via the `/model` picker). */
  modelId: CodingAgentModelId;
  /** Set the model directly. */
  setModelId: (id: CodingAgentModelId) => void;
};

const ChatConfigContext = createContext<ChatConfig | null>(null);

export function ChatConfigProvider({ children }: { children: ReactNode }) {
  // Starts in the safe, read-only default; not persisted across reopens — the
  // active mode is a per-session decision, not a saved attribute of the chat.
  const [mode, setMode] = useState<ModeName>(DEFAULT_MODE);
  const cycle = (dir: 1 | -1) => setMode((m) => cycleMode(m, dir));
  // The model is likewise a per-session choice starting at the registry default,
  // shared across both screens and the text-area label via this same provider.
  const [modelId, setModelId] = useState<CodingAgentModelId>(
    defaultCodingAgentModelId,
  );

  return (
    <ChatConfigContext.Provider
      value={{ mode, setMode, cycle, modelId, setModelId }}
    >
      {children}
    </ChatConfigContext.Provider>
  );
}

/** Read the chat config. Throws if used outside `ChatConfigProvider`. */
export function useChatConfig(): ChatConfig {
  const ctx = useContext(ChatConfigContext);
  if (!ctx) {
    throw new Error("useChatConfig must be used within a ChatConfigProvider");
  }
  return ctx;
}
