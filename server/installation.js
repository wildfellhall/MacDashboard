import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const INSTALLATION_ID_PATH = resolve(
  process.cwd(),
  ".macdashboard",
  "installation-id",
);

const readOrCreateInstallationId = () => {
  try {
    const existing = readFileSync(INSTALLATION_ID_PATH, "utf8").trim();
    if (existing) return existing;
  } catch {
    // The private installation identifier does not exist yet.
  }

  const identifier = randomUUID();
  try {
    mkdirSync(dirname(INSTALLATION_ID_PATH), {
      recursive: true,
      mode: 0o700,
    });
    writeFileSync(INSTALLATION_ID_PATH, `${identifier}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    return identifier;
  } catch {
    try {
      return readFileSync(INSTALLATION_ID_PATH, "utf8").trim() || identifier;
    } catch {
      return identifier;
    }
  }
};

export const resolveSafetyIdentifier = (configuredIdentifier) => {
  const source =
    typeof configuredIdentifier === "string" &&
    configuredIdentifier.trim().length > 0
      ? configuredIdentifier.trim().slice(0, 256)
      : readOrCreateInstallationId();
  return createHash("sha256")
    .update(`macdashboard:${source}`)
    .digest("hex")
    .slice(0, 64);
};
