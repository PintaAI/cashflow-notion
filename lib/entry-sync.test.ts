import { describe, expect, test } from "bun:test";

import {
  decodeEntrySyncCursor,
  decideCreateRetry,
  encodeEntrySyncCursor,
  ENTRY_SYNC_MUTATION_CLEANUP_INTERVAL_MS,
  isEntrySyncMutationCleanupDue,
  storedMutationResult,
} from "./entry-sync";

describe("entry sync cursor", () => {
  test("round-trips the stable updatedAt and id ordering key", () => {
    const updatedAt = new Date("2026-08-19T12:00:00.123Z");
    const cursor = encodeEntrySyncCursor("wallet-a", updatedAt, "entry-b");
    expect(decodeEntrySyncCursor(cursor, "wallet-a")).toEqual({ updatedAt, id: "entry-b" });
  });

  test("rejects use in another wallet", () => {
    const cursor = encodeEntrySyncCursor("wallet-a", new Date(), "entry-a");
    expect(() => decodeEntrySyncCursor(cursor, "wallet-b")).toThrow("Invalid entry sync cursor");
  });

  test("rejects malformed and versionless cursors", () => {
    expect(() => decodeEntrySyncCursor("not-a-cursor", "wallet-a")).toThrow("Invalid entry sync cursor");
    const old = Buffer.from(JSON.stringify({ v: 0, m: "wallet-a", u: new Date().toISOString(), i: "entry-a" })).toString("base64url");
    expect(() => decodeEntrySyncCursor(old, "wallet-a")).toThrow("Invalid entry sync cursor");
  });
});

describe("mutation receipt cleanup gate", () => {
  test("runs initially and at most once per day", () => {
    const now = Date.parse("2026-08-19T12:00:00.000Z");
    expect(isEntrySyncMutationCleanupDue(0, now)).toBe(true);
    expect(isEntrySyncMutationCleanupDue(now, now + ENTRY_SYNC_MUTATION_CLEANUP_INTERVAL_MS - 1)).toBe(false);
    expect(isEntrySyncMutationCleanupDue(now, now + ENTRY_SYNC_MUTATION_CLEANUP_INTERVAL_MS)).toBe(true);
  });
});

describe("entry create retry", () => {
  test("returns the stored result for an exact mutation retry", () => {
    const result = { mutationId: "mutation-a", ok: false as const, error: "original result" };
    expect(storedMutationResult({ result })).toEqual(result);
  });

  test("updates a later create mutation for an existing client ID in the same wallet", () => {
    expect(decideCreateRetry("wallet-a", "wallet-a")).toBe("update");
  });

  test("creates when the client ID is unused and rejects cross-wallet IDs", () => {
    expect(decideCreateRetry(null, "wallet-a")).toBe("create");
    expect(decideCreateRetry("wallet-b", "wallet-a")).toBe("forbidden");
  });
});
