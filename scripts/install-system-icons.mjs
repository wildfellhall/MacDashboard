import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

if (process.platform !== "darwin") {
  console.log("MacDashboard: using redistributable icons on this platform.");
  process.exit(0);
}

const extractor = resolve("scripts/extract-macos-icons.swift");
const destination = resolve("public/local-icons");
const result = spawnSync("/usr/bin/swift", [extractor, destination], {
  stdio: "inherit",
});

if (result.error || result.status !== 0) {
  console.warn(
    "MacDashboard: native icon extraction was unavailable; using the redistributable fallback icons.",
  );
  process.exit(0);
}
