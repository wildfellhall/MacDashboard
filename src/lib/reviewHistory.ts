import type { Note, ReviewRecord } from "../types";

const normalizeTitle = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const parseReviewNotes = (notes: Note[]): ReviewRecord[] =>
  notes
    .filter((note) => note.folder === "Reviews")
    .flatMap((note) => {
      const document = new DOMParser().parseFromString(
        note.content,
        "text/html",
      );
      return [...document.body.querySelectorAll("h2, h3")].flatMap(
        (heading) => {
          const headingText = heading.textContent?.trim() ?? "";
          const match = headingText.match(
            /^(.+?)(?:\s*[—–-]\s*(\d(?:\.\d+)?)\s*\/\s*5)?$/,
          );
          if (!match?.[1]) return [];

          const paragraphs: string[] = [];
          let sibling = heading.nextElementSibling;
          while (sibling && !/^H[123]$/.test(sibling.tagName)) {
            const text = sibling.textContent?.replace(/\s+/g, " ").trim();
            if (text) paragraphs.push(text);
            sibling = sibling.nextElementSibling;
          }
          const summary = paragraphs.join(" ").slice(0, 600);
          const minutesMatch = summary.match(
            /\b(?:time spent\s*:\s*)?(\d{1,5})\s*(?:minutes?|mins?)\b/i,
          );
          const dateMatch = summary.match(
            /\b(?:read|watched|finished|completed|date)\s*:\s*(\d{4}-\d{2}-\d{2})\b/i,
          );
          const parsedRating = match[2]
            ? Number.parseFloat(match[2])
            : undefined;
          const rating =
            parsedRating !== undefined &&
            parsedRating >= 0 &&
            parsedRating <= 5
              ? parsedRating
              : undefined;
          const minutes = minutesMatch
            ? Number.parseInt(minutesMatch[1], 10)
            : undefined;
          const explicitDate = dateMatch?.[1]
            ? new Date(`${dateMatch[1]}T12:00:00.000Z`)
            : null;
          const reviewedAt =
            explicitDate && !Number.isNaN(explicitDate.getTime())
              ? explicitDate.toISOString()
              : note.updatedAt;

          return [
            {
              title: match[1].trim(),
              ...(rating !== undefined ? { rating } : {}),
              ...(minutes !== undefined ? { minutes } : {}),
              reviewedAt,
              summary,
            },
          ];
        },
      );
    });

export const reviewForTitle = (
  title: string,
  reviews: ReviewRecord[],
) => {
  const target = normalizeTitle(title);
  return reviews.find((review) => normalizeTitle(review.title) === target);
};
