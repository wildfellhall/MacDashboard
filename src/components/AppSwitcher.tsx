import type { AppId, AppMeta } from "../types";
import { AppIcon } from "./AppIcon";

type SwitcherItem = {
  app: AppMeta;
  minimized: boolean;
};

type Props = {
  items: SwitcherItem[];
  selectedId: AppId;
  onSelect: (appId: AppId) => void;
};

export function AppSwitcher({ items, selectedId, onSelect }: Props) {
  return (
    <section
      className="app-switcher"
      role="dialog"
      aria-modal="false"
      aria-label="Application switcher"
    >
      <div className="app-switcher-items" role="listbox">
        {items.map(({ app, minimized }) => (
          <button
            key={app.id}
            type="button"
            role="option"
            aria-selected={selectedId === app.id}
            className={selectedId === app.id ? "is-selected" : ""}
            onClick={() => onSelect(app.id)}
          >
            <AppIcon appId={app.id} />
            <strong>{app.name}</strong>
            <span>{minimized ? "Minimized" : "Open"}</span>
          </button>
        ))}
      </div>
      <p>Keep holding ⌘ and press Tab to move</p>
    </section>
  );
}
