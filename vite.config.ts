import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const configuredPort = Number.parseInt(env.API_PORT || "4176", 10);
  const apiPort =
    Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort < 65_536
      ? configuredPort
      : 4176;

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 4175,
      proxy: {
        "/api": `http://127.0.0.1:${apiPort}`,
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 4175,
    },
  };
});
