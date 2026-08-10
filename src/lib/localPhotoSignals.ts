export type LocalPhotoSignals = {
  importedAt: string;
  fileCount: number;
  tags: Array<{ label: string; count: number }>;
  palette: Array<{ label: string; count: number }>;
  formats: Array<{ label: string; count: number }>;
};

const MAX_FILES = 120;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const isSupportedImage = (file: File) =>
  file.type.startsWith("image/") || /\.(?:heic|heif)$/i.test(file.name);
const STOP_WORDS = new Set([
  "camera",
  "copy",
  "downloads",
  "edited",
  "final",
  "heic",
  "image",
  "images",
  "jpeg",
  "jpg",
  "library",
  "original",
  "photo",
  "photos",
  "picture",
  "pictures",
  "png",
  "screenshot",
  "untitled",
  "webp",
]);

const countValues = (values: string[], maximum: number) =>
  [...values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maximum)
    .map(([label, count]) => ({ label, count }));

const metadataTokens = (file: File) => {
  const path =
    "webkitRelativePath" in file &&
    typeof file.webkitRelativePath === "string"
      ? file.webkitRelativePath
      : "";
  return `${path} ${file.name}`
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}\b/g, " ")
    .split(/[^a-z]+/)
    .filter(
      (token) =>
        token.length >= 3 &&
        token.length <= 28 &&
        !STOP_WORDS.has(token) &&
        !/^(?:dsc|img|pxl)\w*$/.test(token),
    );
};

export const analyzePhotoMetadata = (
  files: readonly File[],
): LocalPhotoSignals => {
  const accepted = files
    .filter(
      (file) =>
        isSupportedImage(file) &&
        file.size > 0 &&
        file.size <= MAX_FILE_BYTES,
    )
    .slice(0, MAX_FILES);
  if (!accepted.length) {
    throw new Error(
      "Choose JPEG, PNG, WebP, GIF, or HEIC photos smaller than 25 MB each.",
    );
  }
  const formats = accepted.map(
    (file) =>
      file.type.split("/")[1]?.toLowerCase() ||
      file.name.split(".").pop()?.toLowerCase() ||
      "image",
  );
  return {
    importedAt: new Date().toISOString(),
    fileCount: accepted.length,
    tags: countValues(accepted.flatMap(metadataTokens), 14),
    palette: [],
    formats: countValues(formats, 6),
  };
};

const paletteLabels = (pixels: Uint8ClampedArray) => {
  let samples = 0;
  let saturation = 0;
  let luminance = 0;
  let warm = 0;
  let cool = 0;
  let green = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    if (pixels[index + 3] < 100) continue;
    const red = pixels[index] / 255;
    const blue = pixels[index + 2] / 255;
    const greenValue = pixels[index + 1] / 255;
    const maximum = Math.max(red, greenValue, blue);
    const minimum = Math.min(red, greenValue, blue);
    const delta = maximum - minimum;
    const sampleSaturation =
      maximum === 0 ? 0 : delta / maximum;
    const sampleLuminance =
      red * 0.2126 + greenValue * 0.7152 + blue * 0.0722;
    let hue = 0;
    if (delta > 0) {
      if (maximum === red) {
        hue = 60 * (((greenValue - blue) / delta) % 6);
      } else if (maximum === greenValue) {
        hue = 60 * ((blue - red) / delta + 2);
      } else {
        hue = 60 * ((red - greenValue) / delta + 4);
      }
      if (hue < 0) hue += 360;
    }
    if (sampleSaturation > 0.12) {
      if (hue < 70 || hue >= 330) warm += 1;
      if (hue >= 165 && hue < 275) cool += 1;
      if (hue >= 70 && hue < 165) green += 1;
    }
    saturation += sampleSaturation;
    luminance += sampleLuminance;
    samples += 1;
  }
  if (!samples) return [];
  const labels = [];
  const averageSaturation = saturation / samples;
  const averageLuminance = luminance / samples;
  if (averageSaturation < 0.22) labels.push("muted palette");
  if (averageSaturation > 0.48) labels.push("vibrant color");
  if (averageLuminance < 0.34) labels.push("dark photography");
  if (averageLuminance > 0.67) labels.push("bright photography");
  if (warm / samples > 0.28) labels.push("warm tones");
  if (cool / samples > 0.28) labels.push("cool blue tones");
  if (green / samples > 0.28) labels.push("natural green tones");
  return labels;
};

const pixelsFor = async (file: File) => {
  if (typeof createImageBitmap !== "function") return [];
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 28;
    canvas.height = 28;
    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!context) return [];
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return paletteLabels(
      context.getImageData(0, 0, canvas.width, canvas.height).data,
    );
  } finally {
    bitmap.close();
  }
};

export const analyzeLocalPhotos = async (
  files: readonly File[],
): Promise<LocalPhotoSignals> => {
  const metadata = analyzePhotoMetadata(files);
  const accepted = files
    .filter(
      (file) =>
        isSupportedImage(file) &&
        file.size > 0 &&
        file.size <= MAX_FILE_BYTES,
    )
    .slice(0, Math.min(metadata.fileCount, 24));
  const palettes = await Promise.all(
    accepted.map((file) => pixelsFor(file).catch(() => [])),
  );
  return {
    ...metadata,
    palette: countValues(palettes.flat(), 8),
  };
};

export const localPhotoAffinity = (signals: LocalPhotoSignals | null) =>
  signals
    ? [
        ...signals.tags.slice(0, 8).map((signal) => signal.label),
        ...signals.palette.slice(0, 5).map((signal) => signal.label),
      ]
    : [];
