import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT) || 3000;

const ALLOWED_ROOT_FILES = new Set([
  "index.html",
  "register.html",
  "dashboard.html",
  "roster.html",
  "logistics.html",
  "attendance.html",
  "finance.html",
  "minutes.html",
  "files.html",
  "settings.html",
  "diet.html",
  "expired.html",
  "medical.html",
  "other.html",
  "manifest.json",
  "favicon.svg",
]);

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Serve only public frontend directories (identical to GitHub Pages output)
app.use("/frontend", express.static(path.join(__dirname, "frontend"), { dotfiles: "ignore" }));
app.use("/assets", express.static(path.join(__dirname, "assets"), { dotfiles: "ignore" }));

// Serve ONLY the public frontend config file from backend/ (never Code.js or appsscript.json)
app.get("/backend/config.js", (_req, res) => {
  res.type("application/javascript; charset=utf-8");
  res.sendFile(path.join(__dirname, "backend", "config.js"));
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/:file", (req, res, next) => {
  const file = String(req.params.file || "");
  if (ALLOWED_ROOT_FILES.has(file)) {
    return res.sendFile(path.join(__dirname, file));
  }
  return next();
});

app.use((_req, res) => {
  res.status(404).type("text/plain").send("Not Found");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Static preview server running at http://0.0.0.0:${port}`);
});
