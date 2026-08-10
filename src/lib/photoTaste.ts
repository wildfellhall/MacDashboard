import type { Profile } from "../types";
import type { LocalPhotoSignals } from "./localPhotoSignals";

const VISUAL_SIGNAL =
  /\b(?:architecture|art|atmospheric|beach|books?|buildings?|city|coastal?|colors?|design|flowers?|forest|garden|geometry|interior|landscapes?|library|light|museum|nature|observator(?:y|ies)|ocean|palette|photograph(?:y|ic)?|portraits?|sea|shore|sky|street|tones?|visual(?:ly)?|water)\b/i;
const AESTHETIC_MODIFIERS = new Set([
  "atmospheric",
  "bright",
  "calm",
  "contemplative",
  "dark",
  "dreamlike",
  "gentle",
  "lush",
  "minimal",
  "moody",
  "muted",
  "quiet",
  "thoughtful",
  "vibrant",
  "visually",
  "warm",
]);
const FALLBACK_QUERIES = [
  "quiet architecture",
  "coastal landscape",
  "atmospheric photography",
  "art museum interior",
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

const isAvoided = (value: string, profile: Profile) =>
  profile.avoid.some((avoid) => {
    const normalizedAvoid = normalize(avoid);
    return (
      normalizedAvoid &&
      (value.includes(normalizedAvoid) || normalizedAvoid.includes(value))
    );
  });

const uniqueQueries = (values: string[], profile: Profile) => {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const normalized = normalize(value);
    if (
      normalized.length < 2 ||
      seen.has(normalized) ||
      isAvoided(normalized, profile)
    ) {
      return [];
    }
    seen.add(normalized);
    return [normalized];
  });
};

export const buildPhotoDiscoveryQueries = ({
  query,
  profile,
  noteProfile = profile,
  localSignals,
  dossierSeeds = [],
}: {
  query: string;
  profile: Profile;
  noteProfile?: Profile;
  localSignals: LocalPhotoSignals | null;
  dossierSeeds?: string[];
}) => {
  const explicitQuery = normalize(query);
  if (explicitQuery) {
    const broader = explicitQuery
      .split(" ")
      .filter((token) => !AESTHETIC_MODIFIERS.has(token))
      .join(" ");
    return uniqueQueries(
      [
        explicitQuery,
        broader,
        `${broader || explicitQuery} photography`,
      ],
      profile,
    ).slice(0, 3);
  }

  const localTags = (localSignals?.tags ?? [])
    .slice(0, 4)
    .map((signal) => signal.label);
  const combinedLocal =
    localTags.length >= 2 ? [localTags.slice(0, 3).join(" ")] : [];
  const candidates = [
    ...dossierSeeds.slice(0, 1),
    ...noteProfile.interests.slice(0, 1),
    ...combinedLocal,
    ...localTags,
    ...dossierSeeds.slice(1),
    ...noteProfile.interests.slice(1),
    ...noteProfile.favorites,
    ...noteProfile.moods,
    ...(localSignals?.palette ?? [])
      .slice(0, 3)
      .map((signal) => signal.label),
    ...profile.interests,
    ...profile.favorites,
    ...profile.moods,
  ];
  const ranked = candidates
    .map((value, index) => ({
      value,
      index,
      visual: VISUAL_SIGNAL.test(value) ? 0 : 1,
    }))
    .sort((left, right) => left.visual - right.visual || left.index - right.index)
    .map(({ value }) => value);

  return uniqueQueries([...ranked, ...FALLBACK_QUERIES], profile).slice(0, 4);
};
