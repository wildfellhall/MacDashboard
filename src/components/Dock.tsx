import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { AppId, AppMeta, WindowState } from "../types";
import { AppIcon } from "./AppIcon";

type Props = {
  apps: AppMeta[];
  windows: Partial<Record<AppId, WindowState>>;
  onOpen: (appId: AppId) => void;
};

export function Dock({ apps, windows, onOpen }: Props) {
  const [nativeTrashAvailable, setNativeTrashAvailable] = useState(true);
  const [nativeTrashLoaded, setNativeTrashLoaded] = useState(false);

  return (
    <nav className="dock" aria-label="Applications">
      {apps.map((app) => {
        const appWindow = windows[app.id];
        const isOpen = Boolean(appWindow);
        const isMinimized = Boolean(appWindow?.minimized);
        return (
          <button
            type="button"
            key={app.id}
            className={`dock-item ${isOpen ? "is-running" : ""} ${
              isMinimized ? "is-minimized" : ""
            }`}
            onClick={() => onOpen(app.id)}
            aria-label={
              isMinimized ? `Restore ${app.name}` : `Open ${app.name}`
            }
            aria-pressed={isOpen && !isMinimized}
          >
            <span className="dock-tooltip">{app.name}</span>
            <AppIcon appId={app.id} />
            {appWindow && (
              <span className="dock-running" aria-hidden="true" />
            )}
          </button>
        );
      })}
      <span className="dock-divider" />
      <span
        className="dock-item dock-trash"
        role="img"
        aria-label="Trash unavailable in this browser dashboard"
      >
        <span className="dock-tooltip">Trash</span>
        <span
          className={`trash-icon ${nativeTrashLoaded ? "has-native-icon" : ""}`}
          data-app-icon="trash"
          aria-hidden="true"
        >
          <Trash2 strokeWidth={1.55} />
          {nativeTrashAvailable && (
            <img
              className="trash-icon__native"
              src="/local-icons/trash-empty.png"
              alt=""
              draggable={false}
              data-native-icon="trash"
              onLoad={() => setNativeTrashLoaded(true)}
              onError={() => setNativeTrashAvailable(false)}
            />
          )}
        </span>
      </span>
    </nav>
  );
}
