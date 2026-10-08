import { describe, expect, mock, test } from "bun:test";

mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({ user: { id: "user-1" } }),
    },
  },
}));

mock.module("@/app/actions/recurring", () => ({
  fetchRecurringEntries: async () => [],
  addRecurringEntry: async (data: Record<string, unknown>) => ({
    ...data,
    reminderTime: data.reminderTime ?? "09:00",
  }),
}));

mock.module("@/app/actions/quick-fill", () => ({
  fetchQuickFills: async () => [],
  addQuickFill: async (data: Record<string, unknown>) => data,
}));

mock.module("@/lib/api/client-id", () => ({
  optionalClientId: () => undefined,
}));

const { POST: postRecurring } = await import("./recurring/route");
const { POST: postQuickFill } = await import("./quick-fills/route");

describe("mobile sync API compatibility", () => {
  test("creates a recurring entry when the mobile client omits reminderTime", async () => {
    const response = await postRecurring(
      new Request("http://localhost/api/v1/recurring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Rent",
          nominal: 1_000_000,
          io: "Expenses",
          frequency: "monthly",
          startDate: "2026-09-01",
          managementId: "wallet-1",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: {
        name: "Rent",
        nominal: 1_000_000,
        io: "Expenses",
        frequency: "monthly",
        startDate: "2026-09-01",
        managementId: "wallet-1",
        categoryId: null,
        reminderTime: "09:00",
        dayOfWeek: null,
        dayOfMonth: null,
        monthOfYear: null,
        endDate: null,
      },
    });
  });

  test("creates an amount-less quick fill encoded by the mobile client as zero", async () => {
    const response = await postQuickFill(
      new Request("http://localhost/api/v1/quick-fills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Coffee",
          nominal: 0,
          managementId: "wallet-1",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: {
        name: "Coffee",
        nominal: 0,
        managementId: "wallet-1",
        categoryId: null,
      },
    });
  });
});
