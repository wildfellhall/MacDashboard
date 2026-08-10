import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import type { AppMeta, WindowState } from "../types";

type Props = {
  meta: AppMeta;
  state: WindowState;
  isActive: boolean;
  children: ReactNode;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onChange: (next: Partial<WindowState>) => void;
};

type DragState = {
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
};

type ResizeDirection =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

const RESIZE_LABELS: Record<ResizeDirection, string> = {
  n: "top edge",
  s: "bottom edge",
  e: "right edge",
  w: "left edge",
  ne: "top-right corner",
  nw: "top-left corner",
  se: "bottom-right corner",
  sw: "bottom-left corner",
};

export function AppWindow({
  meta,
  state,
  isActive,
  children,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onChange,
}: Props) {
  const windowRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const focusRequestRef = useRef(false);
  const resizeRef = useRef<
    DragState & {
      direction: ResizeDirection;
    }
  >(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (isActive) focusRequestRef.current = false;
  }, [isActive]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (dragRef.current) {
        const drag = dragRef.current;
        onChangeRef.current({
          x: Math.max(
            8,
            Math.min(
              window.innerWidth - drag.initialWidth - 8,
              drag.initialX + event.clientX - drag.startX,
            ),
          ),
          y: Math.max(
            32,
            Math.min(
              window.innerHeight - drag.initialHeight - 78,
              drag.initialY + event.clientY - drag.startY,
            ),
          ),
        });
      }
      if (resizeRef.current) {
        const resize = resizeRef.current;
        const deltaX = event.clientX - resize.startX;
        const deltaY = event.clientY - resize.startY;
        const east = resize.direction.includes("e");
        const west = resize.direction.includes("w");
        const north = resize.direction.includes("n");
        const south = resize.direction.includes("s");
        let x = resize.initialX;
        let y = resize.initialY;
        let width = resize.initialWidth;
        let height = resize.initialHeight;
        const maximumWidth = Math.max(
          320,
          window.innerWidth - resize.initialX - 8,
        );
        const maximumHeight = Math.max(
          260,
          window.innerHeight - resize.initialY - 78,
        );

        if (east) {
          width = Math.min(
            Math.max(560, resize.initialWidth + deltaX),
            maximumWidth,
          );
        }
        if (west) {
          x = Math.max(
            8,
            Math.min(
              resize.initialX + deltaX,
              resize.initialX + resize.initialWidth - 560,
            ),
          );
          width = resize.initialWidth + resize.initialX - x;
        }
        if (south) {
          height = Math.min(
            Math.max(400, resize.initialHeight + deltaY),
            maximumHeight,
          );
        }
        if (north) {
          y = Math.max(
            32,
            Math.min(
              resize.initialY + deltaY,
              resize.initialY + resize.initialHeight - 400,
            ),
          );
          height = resize.initialHeight + resize.initialY - y;
        }
        onChangeRef.current({
          x,
          y,
          width,
          height,
        });
      }
    };

    const endInteraction = () => {
      dragRef.current = null;
      resizeRef.current = null;
      document.body.classList.remove("is-dragging");
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", endInteraction);
    window.addEventListener("pointercancel", endInteraction);
    window.addEventListener("blur", endInteraction);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", endInteraction);
      window.removeEventListener("pointercancel", endInteraction);
      window.removeEventListener("blur", endInteraction);
      document.body.classList.remove("is-dragging");
    };
  }, []);

  if (state.minimized) return null;

  const requestWindowFocus = () => {
    if (isActive || focusRequestRef.current) return;
    focusRequestRef.current = true;
    onFocus();
  };

  const startDrag = (event: ReactPointerEvent) => {
    if (state.maximized || (event.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      initialX: state.x,
      initialY: state.y,
      initialWidth: state.width,
      initialHeight: state.height,
    };
    document.body.classList.add("is-dragging");
  };

  const startResize = (
    event: ReactPointerEvent,
    direction: ResizeDirection,
  ) => {
    event.stopPropagation();
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      initialX: state.x,
      initialY: state.y,
      initialWidth: state.width,
      initialHeight: state.height,
      direction,
    };
    document.body.classList.add("is-dragging");
    requestWindowFocus();
  };

  const handleTitlebarDoubleClick = (event: ReactMouseEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    onMaximize();
  };

  return (
    <section
      ref={windowRef}
      className={`app-window ${isActive ? "is-active" : ""} ${
        state.maximized ? "is-maximized" : ""
      }`}
      data-app={meta.id}
      style={{
        left: state.x,
        top: state.y,
        width: state.width,
        height: state.height,
        zIndex: state.z,
      }}
      onPointerDown={requestWindowFocus}
      onFocusCapture={requestWindowFocus}
      role="dialog"
      aria-label={`${meta.name} window`}
      aria-modal="false"
      data-active={isActive ? "true" : "false"}
    >
      <div
        className="window-titlebar"
        onPointerDown={startDrag}
        onDoubleClick={handleTitlebarDoubleClick}
      >
        <div className="traffic-lights" aria-label="Window controls">
          <button
            className="traffic traffic--close"
            type="button"
            onClick={onClose}
            aria-label={`Close ${meta.name}`}
          >
            <span className="traffic-glyph traffic-glyph--close" aria-hidden="true" />
          </button>
          <button
            className="traffic traffic--minimize"
            type="button"
            onClick={onMinimize}
            aria-label={`Minimize ${meta.name}`}
          >
            <span
              className="traffic-glyph traffic-glyph--minimize"
              aria-hidden="true"
            />
          </button>
          <button
            className="traffic traffic--maximize"
            type="button"
            onClick={onMaximize}
            aria-label={`${state.maximized ? "Restore" : "Zoom"} ${meta.name}`}
          >
            <span
              className="traffic-glyph traffic-glyph--maximize"
              aria-hidden="true"
            />
          </button>
        </div>
        <span className="window-title">{meta.name}</span>
        <span className="titlebar-spacer" />
      </div>
      <div className="window-content">{children}</div>
      {!state.maximized && (
        <>
          {(Object.keys(RESIZE_LABELS) as ResizeDirection[]).map(
            (direction) => (
              <button
                key={direction}
                type="button"
                tabIndex={-1}
                className={`resize-zone resize-zone--${direction}`}
                aria-label={`Resize ${meta.name} from ${RESIZE_LABELS[direction]}`}
                onPointerDown={(event) => startResize(event, direction)}
              />
            ),
          )}
        </>
      )}
    </section>
  );
}
