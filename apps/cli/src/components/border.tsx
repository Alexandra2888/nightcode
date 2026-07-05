import type { ReactNode } from "react";

/**
 * OpenCode's signature detached left bar: a slim, full-height colored gutter to
 * the left of a block, with a gap between the bar and the content. OpenCode
 * renders it as a dedicated element rather than a `borderLeft` — there is no
 * `borderWidth`, and a plain left border reads as a thin line rather than the
 * chunky detached bar. We render it as a `flexDirection="row"`: a fixed
 * 1-column box painted with `backgroundColor` (which stretches to the content's
 * height via the default `alignItems: "stretch"`), then the content, offset by
 * `gap` blank columns so the bar sits detached.
 *
 * Used by the prompt box (bar = the active mode's color) and by each user
 * message (bar = the mode it was sent in), plus the assistant's quieter
 * reasoning/tool blocks (a muted bar).
 */
type BorderProps = {
  /** Bar color. */
  color: string;
  /** Blank columns between the bar and the content. Default 1 (the detachment). */
  gap?: number;
  children: ReactNode;
};

export function Border({ color, gap = 1, children }: BorderProps) {
  return (
    <box flexDirection="row">
      <box width={1} backgroundColor={color} />
      <box flexGrow={1} paddingLeft={gap}>
        {children}
      </box>
    </box>
  );
}
