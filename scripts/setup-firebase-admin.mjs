/**
 * One-time setup: create Firebase Admin service account key via Firebase CLI credentials.
 * Run: node scripts/setup-firebase-admin.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROJECT_ID = "bagrut-66469";

function getFirebaseCliTokens() {
  const paths = [
    join(homedir(), ".config", "configstore", "firebase-tools.json"),
    join(process.env.APPDATA || "", "firebase", "tools.json"),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      const data = JSON.parse(readFileSync(p, "utf-8"));
      if (data.tokens?.refresh_token) return data.tokens;
    }
  }
  throw new Error("Firebase CLI not logged in. Run: firebase login");
}

async function getAccessToken(refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
      client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get access token: " + JSON.stringify(data));
  return data.access_token;
}

async function listServiceAccounts(accessToken) {
  const res = await fetch(
    `https://iam.googleapis.com/v1/projects/${PROJECT_ID}/serviceAccounts`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.accounts || [];
}

async function createServiceAccountKey(accessToken, serviceAccountEmail) {
  const res = await fetch(
    `https://iam.googleapis.com/v1/projects/${PROJECT_ID}/serviceAccounts/${serviceAccountEmail}/keys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyAlgorithm: "KEY_ALG_RSA_2048",
        privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
      }),
    }
  );
  const data = await res.json();
  if (!data.privateKeyData) {
    throw new Error("Failed to create key: " + JSON.stringify(data));
  }
  return JSON.parse(Buffer.from(data.privateKeyData, "base64").toString("utf-8"));
}

async function main() {
  console.log("Getting Firebase CLI credentials...");
  const tokens = getFirebaseCliTokens();
  const accessToken = await getAccessToken(tokens.refresh_token);

  console.log("Listing service accounts...");
  const accounts = await listServiceAccounts(accessToken);
  const adminSa = accounts.find((a) => a.email?.includes("firebase-adminsdk"));

  if (!adminSa) {
    throw new Error("No firebase-adminsdk service account found in project");
  }

  console.log("Creating service account key for", adminSa.email);
  const keyJson = await createServiceAccountKey(accessToken, adminSa.email);

  const envPath = join(process.cwd(), ".env.local");
  let env = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";

  const privateKeyEscaped = keyJson.private_key.replace(/\n/g, "\\n");

  const updates = {
    FIREBASE_PROJECT_ID: PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: keyJson.client_email,
    FIREBASE_PRIVATE_KEY: `"${privateKeyEscaped}"`,
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}=${value}`;
    env = regex.test(env) ? env.replace(regex, line) : env + `\n${line}`;
  }

  writeFileSync(envPath, env.trim() + "\n");
  console.log("Updated .env.local with Firebase Admin credentials");
  console.log("Done! Run: npm run db:seed");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
