import {
  Aperture,
  BookOpen,
  BookOpenText,
  MessageCircle,
  StickyNote,
  Tv,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
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
  dictionary: BookOpenText,
};

export function AppIcon({ appId, size = "large" }: Props) {
  const Glyph = APP_GLYPHS[appId];
  const [nativeAvailable, setNativeAvailable] = useState(true);
  const [nativeLoaded, setNativeLoaded] = useState(false);

  return (
    <span
      className={`app-icon app-icon--${size} app-icon--${appId} ${
        nativeLoaded ? "has-native-icon" : ""
      }`}
      data-app-icon={appId}
      aria-hidden="true"
    >
      <span className="app-icon__shine" />
      <Glyph className="app-icon__glyph" strokeWidth={1.75} />
      {nativeAvailable && (
        <img
          className="app-icon__native"
          src={`/local-icons/${appId}.png`}
          alt=""
          draggable={false}
          data-native-icon={appId}
          onLoad={() => setNativeLoaded(true)}
          onError={() => setNativeAvailable(false)}
        />
      )}
    </span>
  );
}
