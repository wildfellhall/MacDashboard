import { createApp } from "./app.js";

const host = process.env.HOST || "127.0.0.1";
const port = Number.parseInt(process.env.API_PORT || "4176", 10);

if (host !== "127.0.0.1") {
  throw new Error(
    "MacDashboard's assistant service must bind to 127.0.0.1.",
  );
}
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("API_PORT must be a valid TCP port.");
}

const app = createApp();
const server = app.listen(port, host, () => {
  console.log(
    `MacDashboard assistant listening on http://${host}:${port} (local-only).`,
  );
});

const shutdown = (signal) => {
  console.log(`Received ${signal}; closing MacDashboard assistant.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
