import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "./api.js";
import { OperationsRepository } from "./repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const repository = new OperationsRepository();
const port = Number(process.env.PORT ?? 3000);

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:");
  next();
});
app.use("/api", createApi(repository));

const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir));
app.use((_req, res) => res.sendFile(path.join(publicDir, "index.html")));

app.listen(port, "0.0.0.0", () => {
  console.log(`CB-CSCE listening on 0.0.0.0:${port} in ${repository.mode} mode`);
});
