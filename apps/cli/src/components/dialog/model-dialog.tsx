import { useMemo } from "react";
import { TextAttributes } from "@opentui/core";
import {
  codingAgentModels,
  getCodingAgentProviderLabel,
} from "nightcode-ai/client";
import { useChatConfig } from "../../lib/chat-config.tsx";
import { useTheme } from "../../lib/theme/index.ts";
import { DIALOG_IDS } from "./dialog-ids.ts";
import { SearchListDialog } from "./search-list-dialog.tsx";

/** The dialog id — shared with the `/model` command via `DIALOG_IDS`. */
const DIALOG_ID = DIALOG_IDS.model;

/**
 * The `/model` picker: a searchable list of the coding-agent models from the
 * `nightcode-ai` registry (the single source of truth for which models exist).
 * Selecting one updates the shared chat config, so the next request routes to
 * that model/provider and the text-area label updates. Unlike the theme picker
 * there's no live preview — a selection is a committed choice, nothing to revert
 * on close, so this needs no `open`-gated effect.
 *
 * Always mounted at `RouterLayout` so its key handler registers ahead of the
 * screens' (the `dialog.tsx` registration-order rule); it renders nothing until
 * it's the active dialog.
 */
export function ModelDialog() {
  const { theme } = useTheme();
  const { modelId, setModelId } = useChatConfig();
  // A stable mutable copy of the readonly registry tuple; the element type keeps
  // the literal `id`s so `onSelect`'s `model.id` is a `CodingAgentModelId`.
  const models = useMemo(() => [...codingAgentModels], []);

  return (
    <SearchListDialog
      id={DIALOG_ID}
      title="Model"
      items={models}
      toText={(model) => `${model.label} ${getCodingAgentProviderLabel(model.id)}`}
      itemKey={(model) => model.id}
      placeholder="Search models…"
      emptyText="No models"
      onSelect={(model) => setModelId(model.id)}
      renderItem={(model, selected) => (
        <box flexDirection="row" justifyContent="space-between" gap={2}>
          <text
            fg={selected ? theme.text.primary : undefined}
            attributes={selected ? TextAttributes.BOLD : undefined}
          >
            {model.label}
          </text>
          <box flexDirection="row" gap={1}>
            <text attributes={TextAttributes.DIM}>
              {getCodingAgentProviderLabel(model.id)}
            </text>
            {/* Mark the currently-selected model so it's findable in the list. */}
            {model.id === modelId ? (
              <text attributes={TextAttributes.DIM}>active</text>
            ) : null}
          </box>
        </box>
      )}
    />
  );
}
