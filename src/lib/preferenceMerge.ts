const FIELD_LABELS = ["Interests", "Moods", "Favorites", "Avoid"] as const;

export const PREFERENCE_SUGGESTION_PATTERN =
  /^(?:Interests|Moods|Favorites|Avoid)\s*:\s*\S+/i;

const parseSuggestion = (suggestion: string) => {
  const lines = suggestion
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const values = new Map<string, string[]>();

  for (const line of lines) {
    const match = line.match(
      /^(Interests|Moods|Favorites|Avoid)\s*:\s*(.+)$/i,
    );
    if (!match) return null;
    const label = FIELD_LABELS.find(
      (candidate) => candidate.toLowerCase() === match[1].toLowerCase(),
    );
    const items = match[2]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!label || !items.length) return null;
    values.set(label, items);
  }

  return values.size ? values : null;
};

export const mergePreferenceSuggestion = (
  preferencesHtml: string,
  suggestion: string,
) => {
  const additions = parseSuggestion(suggestion);
  if (!additions) return null;

  const document = new DOMParser().parseFromString(
    preferencesHtml,
    "text/html",
  );
  const appliedFields: string[] = [];

  for (const [label, newItems] of additions) {
    const paragraph = [...document.body.querySelectorAll("p")].find((item) =>
      item.textContent?.trim().toLowerCase().startsWith(`${label.toLowerCase()}:`),
    );
    if (!paragraph) continue;

    const current = (paragraph.textContent ?? "")
      .replace(new RegExp(`^${label}\\s*:\\s*`, "i"), "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const merged = [
      ...current,
      ...newItems.filter(
        (item) =>
          !current.some(
            (existing) => existing.toLowerCase() === item.toLowerCase(),
          ),
      ),
    ];

    paragraph.textContent = "";
    const strong = document.createElement("strong");
    strong.textContent = `${label}:`;
    paragraph.append(strong, ` ${merged.join(", ")}`);
    appliedFields.push(label);
  }

  if (!appliedFields.length) return null;
  return {
    html: document.body.innerHTML,
    appliedFields,
  };
};
