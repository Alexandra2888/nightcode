// Shared entry for `nightcode-ai` — the Zod-only half, safe for both the server
// and the CLI to import. It exposes the tool schemas, the tool type map, and the
// mode registry (behaviour profiles pairing a system prompt with a tool
// allow-list), and imports nothing from the AI SDK or the filesystem. The AI-SDK
// agent lives behind `nightcode-ai/server`; the tool runners + UI tool-call
// handler live behind `nightcode-ai/client`.
export {
  toolSchemas,
  readFile,
  writeFile,
  editFile,
  listDirectory,
  grep,
  bash,
} from "./tools/schemas.ts";

export type {
  ToolName,
  ToolInputs,
  ToolOutputs,
  ToolInput,
  ToolOutput,
} from "./types.ts";

export {
  modes,
  DEFAULT_MODE,
  modeSchema,
  modeByName,
  getSystemInstructions,
  cycleMode,
  messageMetadataSchema,
} from "./modes.ts";
export type { ModeConfig, ModeName, MessageMetadata } from "./modes.ts";
