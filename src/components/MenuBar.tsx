import { BatteryMedium, Diamond, Search, Wifi } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AppId, AppMeta } from "../types";

type Props = {
  activeApp?: AppMeta;
  onCloseActive: () => void;
  onMinimizeActive: () => void;
  onZoomActive: () => void;
  onBringAllToFront: () => void;
  onAskDashboard: () => void;
  windowItems: Array<{
    id: AppId;
    name: string;
    minimized: boolean;
    active: boolean;
  }>;
  onActivateWindow: (appId: AppId) => void;
};

type MenuName =
  | "dashboard"
  | "file"
  | "edit"
  | "view"
  | "window"
  | "help";
type BatterySnapshot = {
  level: number;
  charging: boolean;
};
type BatteryManagerLike = BatterySnapshot & {
  addEventListener: (name: string, listener: () => void) => void;
  removeEventListener: (name: string, listener: () => void) => void;
};
const MENU_ORDER: MenuName[] = [
  "dashboard",
  "file",
  "edit",
  "view",
  "window",
  "help",
];

export function MenuBar({
  activeApp,
  onCloseActive,
  onMinimizeActive,
  onZoomActive,
  onBringAllToFront,
  onAskDashboard,
  windowItems,
  onActivateWindow,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const [battery, setBattery] = useState<BatterySnapshot | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    let manager: BatteryManagerLike | null = null;
    let disposed = false;
    const getBattery = (
      navigator as Navigator & {
        getBattery?: () => Promise<BatteryManagerLike>;
      }
    ).getBattery;
    const updateBattery = () => {
      if (manager && !disposed) {
        setBattery({
          level: manager.level,
          charging: manager.charging,
        });
      }
    };
    if (getBattery) {
      void getBattery.call(navigator).then((next) => {
        if (disposed) return;
        manager = next;
        updateBattery();
        manager.addEventListener("levelchange", updateBattery);
        manager.addEventListener("chargingchange", updateBattery);
      }).catch(() => undefined);
    }
    return () => {
      disposed = true;
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      manager?.removeEventListener("levelchange", updateBattery);
      manager?.removeEventListener("chargingchange", updateBattery);
    };
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", escape);
    };
  }, [openMenu]);

  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(now);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  const invoke = (action: () => void) => {
    setOpenMenu(null);
    action();
  };

  const focusTrigger = (name: MenuName) => {
    menuRef.current
      ?.querySelector<HTMLElement>(`[data-menu-trigger="${name}"]`)
      ?.focus();
  };

  const focusMenuItem = (name: MenuName, edge: "first" | "last" = "first") => {
    window.requestAnimationFrame(() => {
      const items = [
        ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
          `[data-menu-name="${name}"] [role="menuitem"]:not(:disabled)`,
        ) ?? []),
      ];
      const item = edge === "last" ? items.at(-1) : items[0];
      if (item) item.focus();
      else focusTrigger(name);
    });
  };

  const moveToMenu = (name: MenuName, offset: number) => {
    const current = MENU_ORDER.indexOf(name);
    const next =
      MENU_ORDER[
        (current + offset + MENU_ORDER.length) % MENU_ORDER.length
      ];
    setOpenMenu(next);
    focusMenuItem(next);
  };

  const handleMenuKeyboard = (
    event: ReactKeyboardEvent<HTMLElement>,
  ) => {
    const target = event.target as HTMLElement;
    const triggerName = target.dataset.menuTrigger as MenuName | undefined;
    const menu = target.closest<HTMLElement>("[data-menu-name]");
    const menuName = menu?.dataset.menuName as MenuName | undefined;

    if (triggerName) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setOpenMenu(triggerName);
        focusMenuItem(triggerName);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveToMenu(triggerName, -1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveToMenu(triggerName, 1);
      }
      return;
    }
    if (!menu || !menuName) return;
    const items = [
      ...menu.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ),
    ];
    const index = items.indexOf(target as HTMLButtonElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      const next = items[(index + offset + items.length) % items.length];
      next?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? items[0] : items.at(-1))?.focus();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveToMenu(menuName, -1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveToMenu(menuName, 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpenMenu(null);
      focusTrigger(menuName);
    } else if (event.key === "Tab") {
      setOpenMenu(null);
    }
  };

  const trigger = (name: MenuName, label: string) => (
    <button
      type="button"
      aria-label={`${label} menu`}
      aria-haspopup="menu"
      aria-expanded={openMenu === name}
      data-menu-trigger={name}
      className={openMenu === name ? "is-open" : ""}
      onClick={() => setOpenMenu((current) => (current === name ? null : name))}
    >
      {label}
    </button>
  );

  return (
    <header
      className="menu-bar"
      ref={menuRef}
      onKeyDown={handleMenuKeyboard}
    >
      <div className="menu-left">
        <span className="menu-trigger-wrap menu-trigger-wrap--brand">
          <button
            type="button"
            className={`brand-mark ${openMenu === "dashboard" ? "is-open" : ""}`}
            aria-label="MacDashboard menu"
            aria-haspopup="menu"
            aria-expanded={openMenu === "dashboard"}
            data-menu-trigger="dashboard"
            onClick={() =>
              setOpenMenu((current) =>
                current === "dashboard" ? null : "dashboard",
              )
            }
          >
            <Diamond size={12} strokeWidth={2.4} fill="currentColor" />
          </button>
          {openMenu === "dashboard" && (
            <span
              className="menu-dropdown"
              role="menu"
              data-menu-name="dashboard"
            >
              <button type="button" role="menuitem" disabled>
                About MacDashboard
              </button>
              <span className="menu-separator" />
              <button type="button" role="menuitem" disabled>
                System Settings…
              </button>
            </span>
          )}
        </span>
        <strong>{activeApp?.name ?? "MacDashboard"}</strong>
        <span className="menu-trigger-wrap">
          {trigger("file", "File")}
          {openMenu === "file" && (
            <span
              className="menu-dropdown"
              role="menu"
              data-menu-name="file"
            >
              <button
                type="button"
                role="menuitem"
                disabled={!activeApp}
                onClick={() => invoke(onCloseActive)}
              >
                Close Window <kbd>⌘W</kbd>
              </button>
            </span>
          )}
        </span>
        <span className="menu-trigger-wrap">
          {trigger("edit", "Edit")}
          {openMenu === "edit" && (
            <span
              className="menu-dropdown"
              role="menu"
              data-menu-name="edit"
            >
              <button type="button" role="menuitem" disabled>
                Undo <kbd>⌘Z</kbd>
              </button>
              <span className="menu-separator" />
              <button type="button" role="menuitem" disabled>
                Cut
              </button>
              <button type="button" role="menuitem" disabled>
                Copy
              </button>
              <button type="button" role="menuitem" disabled>
                Paste
              </button>
            </span>
          )}
        </span>
        <span className="menu-trigger-wrap">
          {trigger("view", "View")}
          {openMenu === "view" && (
            <span
              className="menu-dropdown"
              role="menu"
              data-menu-name="view"
            >
              <button
                type="button"
                role="menuitem"
                disabled={!activeApp}
                onClick={() => invoke(onZoomActive)}
              >
                Zoom
              </button>
            </span>
          )}
        </span>
        <span className="menu-trigger-wrap">
          {trigger("window", "Window")}
          {openMenu === "window" && (
            <span
              className="menu-dropdown menu-dropdown--wide"
              role="menu"
              data-menu-name="window"
            >
              <button
                type="button"
                role="menuitem"
                disabled={!activeApp}
                onClick={() => invoke(onMinimizeActive)}
              >
                Minimize <kbd>⌘M</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!activeApp}
                onClick={() => invoke(onZoomActive)}
              >
                Zoom
              </button>
              <span className="menu-separator" />
              <button
                type="button"
                role="menuitem"
                onClick={() => invoke(onBringAllToFront)}
              >
                Bring All to Front
              </button>
              {windowItems.length > 0 && (
                <>
                  <span className="menu-separator" />
                  {windowItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      aria-label={`${item.active ? "Active: " : ""}${item.name}${
                        item.minimized ? ", minimized" : ""
                      }`}
                      onClick={() => invoke(() => onActivateWindow(item.id))}
                    >
                      <span className="window-menu-label">
                        <span
                          className="window-menu-check"
                          aria-hidden="true"
                        >
                          {item.active ? "✓" : ""}
                        </span>
                        {item.name}
                      </span>
                      {item.minimized && (
                        <span className="window-menu-state">Minimized</span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </span>
          )}
        </span>
        <span className="menu-trigger-wrap">
          {trigger("help", "Help")}
          {openMenu === "help" && (
            <span
              className="menu-dropdown menu-dropdown--wide"
              role="menu"
              data-menu-name="help"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => invoke(onAskDashboard)}
              >
                Ask Dashboard
              </button>
            </span>
          )}
        </span>
      </div>
      <div className="menu-right">
        <span
          className="menu-status menu-status--battery"
          role="status"
          aria-label={
            battery
              ? `Battery at ${Math.round(battery.level * 100)} percent${
                  battery.charging ? ", charging" : ""
                }`
              : "Battery status unavailable to this browser"
          }
          title={
            battery
              ? `Battery: ${Math.round(battery.level * 100)}%${
                  battery.charging ? " · Charging" : ""
                }`
              : "Battery status unavailable to this browser"
          }
        >
          {battery && <span>{Math.round(battery.level * 100)}%</span>}
          <BatteryMedium size={18} strokeWidth={1.8} />
        </span>
        <span
          className="menu-status"
          role="status"
          aria-label={`Network appears ${online ? "online" : "offline"}`}
          title={`Browser network status: ${online ? "online" : "offline"}`}
        >
          <Wifi size={16} strokeWidth={2.1} />
        </span>
        <button
          type="button"
          className="menu-status"
          aria-label="Spotlight search"
          title="Spotlight"
          onClick={onAskDashboard}
        >
          <Search size={15} strokeWidth={2.2} />
        </button>
        <span
          className="menu-status control-center"
          aria-hidden="true"
        >
          <span className="control-center-line">
            <i />
          </span>
          <span className="control-center-line">
            <i />
          </span>
        </span>
        <time dateTime={now.toISOString()}>
          <span>{date}</span>
          <span>{time}</span>
        </time>
      </div>
    </header>
  );
}
