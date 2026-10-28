import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createApi } from "./api.js";
import { OperationsRepository } from "./repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const repository = new OperationsRepository();
const port = Number(process.env.PORT ?? 3000);

app.disable("x-powered-by");
app.set("trust proxy", false);
app.use(express.json({ limit: "256kb", strict: true, type: "application/json" }));
app.use((req, res, next) => {
  const requestId = req.get("x-request-id")?.trim() || randomUUID();
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api", createApi(repository));

const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir, { index: "index.html", fallthrough: true }));
app.use((_req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(error);
  if (error instanceof SyntaxError) return res.status(400).json({ error: "INVALID_JSON" });
  if (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") return res.status(413).json({ error: "REQUEST_TOO_LARGE" });
  console.error("Unhandled request error", error);
  return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`CB-CSCE listening on 0.0.0.0:${port} in ${repository.mode} mode`);
});
