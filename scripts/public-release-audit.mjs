import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const tracked = spawnSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
});

if (tracked.status !== 0) {
  console.error("Public-release audit requires a Git working tree.");
  process.exit(1);
}

const files = tracked.stdout.split("\0").filter(Boolean);
const findings = [];
const forbiddenFiles = [
  /^\.env$/,
  /^\.env\.(?!example$)/,
  /^\.macdashboard\//,
  /^node_modules\//,
  /^dist\//,
  /^public\/icons\/.*\.png$/i,
  /^public\/local-icons\//,
];
const secretPatterns = [
  ["OpenAI-style secret", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/g],
  [
    "populated credential setting",
    /\b(?:OPENAI_API_KEY|TMDB_READ_ACCESS_TOKEN|GH_TOKEN|GITHUB_TOKEN)[ \t]*=[ \t]*["']?[^\s"'#]+/g,
  ],
  [
    "private key",
    /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g,
  ],
];
const allowedHomeNames = new Set(["example", "runner", "username"]);

for (const file of files) {
  if (!existsSync(file)) continue;
  if (forbiddenFiles.some((pattern) => pattern.test(file))) {
    findings.push(`${file}: must not be tracked`);
    continue;
  }

  const bytes = readFileSync(file);
  const content = bytes.toString("latin1");
  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) findings.push(`${file}: ${label}`);
  }

  for (const match of content.matchAll(/(?:\/Users\/|\/home\/)([A-Za-z0-9._-]+)/g)) {
    if (!allowedHomeNames.has(match[1])) {
      findings.push(`${file}: local home-directory path`);
    }
  }
  for (const match of content.matchAll(/\b[A-Za-z]:\\Users\\([A-Za-z0-9._-]+)/g)) {
    if (!allowedHomeNames.has(match[1])) {
      findings.push(`${file}: local Windows home-directory path`);
    }
  }
}

if (findings.length > 0) {
  console.error("Public-release audit failed:\n");
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Public-release audit passed (${files.length} tracked files checked).`);
