export const DEFAULT_DESKTOP_COLOR = "#8faec5";

export const DESKTOP_COLOR_PRESETS = [
  { name: "Harbor", color: DEFAULT_DESKTOP_COLOR },
  { name: "Sky", color: "#84b7d8" },
  { name: "Lavender", color: "#aa9dca" },
  { name: "Sage", color: "#8eaa98" },
  { name: "Rose", color: "#c49ba4" },
  { name: "Sand", color: "#c2ab87" },
  { name: "Graphite", color: "#79838f" },
] as const;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const normalizeDesktopColor = (value: unknown) =>
  typeof value === "string" && HEX_COLOR.test(value.trim())
    ? value.trim().toLowerCase()
    : DEFAULT_DESKTOP_COLOR;

export const desktopColorTone = (color: string) => {
  const normalized = normalizeDesktopColor(color);
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return luminance > 0.64 ? "light" : "dark";
};
