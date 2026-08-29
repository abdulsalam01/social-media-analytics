import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

export function createConfiguredClient(): Client {
  const remoteUrl = process.env.TURSO_DATABASE_URL;
  if (remoteUrl?.startsWith("libsql://")) {
    return createClient({
      url: remoteUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
      intMode: "number",
    });
  }

  const filePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "data.db");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  return createClient({ url: `file:${filePath}`, intMode: "number" });
}
