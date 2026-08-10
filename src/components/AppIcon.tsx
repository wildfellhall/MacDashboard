import {
  Aperture,
  BookOpen,
  MessageCircle,
  StickyNote,
  Tv,
  type LucideIcon,
} from "lucide-react";
import type { AppId } from "../types";

type Props = {
  appId: AppId;
  size?: "small" | "large";
};

const APP_GLYPHS: Record<AppId, LucideIcon> = {
  messages: MessageCircle,
  notes: StickyNote,
  photos: Aperture,
  books: BookOpen,
  tv: Tv,
};

export function AppIcon({ appId, size = "large" }: Props) {
  const Glyph = APP_GLYPHS[appId];

  return (
    <span
      className={`app-icon app-icon--${size} app-icon--${appId}`}
      data-app-icon={appId}
      aria-hidden="true"
    >
      <span className="app-icon__shine" />
      <Glyph className="app-icon__glyph" strokeWidth={1.75} />
    </span>
  );
}
