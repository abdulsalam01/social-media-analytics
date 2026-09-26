import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { calculateFollowerImpact } from "../lib/follower-impact.ts";
import { ensureSchema } from "../lib/migrations.ts";

test("follower impact is disabled at zero and uses baseline when no snapshot exists", () => {
  assert.deepEqual(calculateFollowerImpact(0, 125), {
    enabled: false,
    initialFollowers: 0,
    currentFollowers: 125,
    impact: 0,
    impactRate: null,
  });
  assert.deepEqual(calculateFollowerImpact(100, null), {
    enabled: true,
    initialFollowers: 100,
    currentFollowers: 100,
    impact: 0,
    impactRate: 0,
  });
});

test("editing the baseline recalculates impact without changing the current snapshot", () => {
  const first = calculateFollowerImpact(100, 125);
  const edited = calculateFollowerImpact(110, 125);
  assert.equal(first.currentFollowers, 125);
  assert.equal(first.impact, 25);
  assert.equal(first.impactRate, 0.25);
  assert.equal(edited.currentFollowers, 125);
  assert.equal(edited.impact, 15);
  assert.equal(edited.impactRate, 15 / 110);
  assert.equal(calculateFollowerImpact(100, 80).impact, -20);
});

test("additive migration preserves existing account data and defaults baseline to zero", async () => {
  const client = createClient({ url: "file::memory:", intMode: "number" });
  try {
    await client.executeMultiple(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        handle TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(platform, handle)
      );
      INSERT INTO accounts (name, platform, handle, created_at)
      VALUES ('Data Lama', 'instagram', 'data.lama', '2026-01-02 03:04:05');
    `);

    await ensureSchema(client);
    await ensureSchema(client); // idempotent: deployment restarts are safe

    const result = await client.execute("SELECT id, name, platform, handle, initial_followers, created_at FROM accounts WHERE id = 1");
    assert.deepEqual({ ...result.rows[0] }, {
      id: 1,
      name: "Data Lama",
      platform: "instagram",
      handle: "data.lama",
      initial_followers: 0,
      created_at: "2026-01-02 03:04:05",
    });
    const columns = await client.execute("PRAGMA table_info(accounts)");
    assert.equal(columns.rows.filter((row) => row.name === "initial_followers").length, 1);
  } finally {
    client.close();
  }
});
