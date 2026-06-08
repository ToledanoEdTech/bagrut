import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const envPath = join(process.cwd(), ".env.local");
if (!existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const keys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];

const env = {};
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1).replace(/\\n/g, "\n");
  }
  env[key] = value;
}

for (const key of keys) {
  if (!env[key]) {
    console.warn(`Skip ${key} (empty)`);
    continue;
  }
  console.log(`Setting ${key}...`);
  try {
    execSync(`npx vercel env rm ${key} production --yes`, { stdio: "ignore" });
  } catch {}
  execSync(`npx vercel env add ${key} production`, {
    input: env[key],
    stdio: ["pipe", "inherit", "inherit"],
  });
}

console.log("Environment variables uploaded to Vercel");
