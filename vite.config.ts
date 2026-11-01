import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Only these prefixes are inlined into the client bundle via import.meta.env.
const envPrefix = ["VITE_", "CLERK_PUBLISHABLE_"];

// A prefix "matches" CLERK_SECRET if it would expose a CLERK_SECRET* variable
// (e.g. "CLERK_", "CLERK_SECRET_") or is itself scoped under CLERK_SECRET.
const forbidden = "CLERK_SECRET";
for (const prefix of envPrefix) {
  if (!prefix || forbidden.startsWith(prefix) || prefix.startsWith(forbidden)) {
    throw new Error(`vite envPrefix "${prefix}" would expose ${forbidden}* variables to the client bundle.`);
  }
}

export default defineConfig({
  plugins: [react()],
  envPrefix,
  server: { host: "0.0.0.0", port: 3000 },
  build: { outDir: "dist/public" }
});
