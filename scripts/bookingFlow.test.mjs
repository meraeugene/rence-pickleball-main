import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const loadDependency = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const courtId = "00000000-0000-0000-0000-000000000001";
const rules = {
  settings: { openHour: 8, closeHour: 11, timezone: "Asia/Manila" },
  courts: [{ id: courtId, name: "Court 1", description: "Indoor" }],
  pricingBands: [{ id: "custom", label: "Custom", startHour: 8, endHour: 11, hourlyRate: 375, sortOrder: 1, active: true }],
};

function createLoader(mocks = {}) {
  const cache = new Map();
  function load(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (!name.startsWith("@/")) return loadDependency(name);
    const file = path.join(root, "src", name.slice(2) + ".ts");
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} };
    cache.set(file, loadedModule);
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function("require", "module", "exports", output)(load, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

function bookingFixture({ user = { id: "test-user", email: null }, conflict = false } = {}) {
  const inserts = [];
  const emails = [];
  const client = {
    from(table) {
      if (table === "courts") return { select: () => ({ in: async () => ({ data: rules.courts, error: null }) }) };
      if (table === "bookings") return {
        insert: async rows => {
          inserts.push(rows);
          return { error: conflict ? { message: "booking_slot_conflict" } : null };
        },
      };
      throw new Error("Unexpected table: " + table);
    },
  };
  const load = createLoader({
    "next/cache": { revalidatePath() {}, unstable_cache: fn => fn },
    "@/utils/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    "@/utils/supabase/admin": { createAdminClient: () => client },
    "@/utils/booking/getBusinessRules": { getBusinessRules: async () => rules },
    "@/utils/email/bookingEmail": { sendNewBookingAdminEmail: async data => { emails.push(data); } },
  });
  return { action: load("@/actions/bookings/createManualBooking").createManualBooking, inserts, emails };
}

function bookingForm(overrides = {}) {
  const values = {
    date: "2099-11-04",
    selections: JSON.stringify([{ courtId, startHour: 9 }, { courtId, startHour: 10 }]),
    customerName: "Booking Test",
    customerContact: "09170000000",
    paymentMethod: "GOTYME",
    paymentAmountMode: "HALF",
    paymentProofUrl: "https://example.invalid/proof.jpg",
    paymentProofPublicId: "test-only/proof",
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

test("unverified availability is never selectable; an empty schedule stays empty", () => {
  const calendar = createLoader()("@/utils/booking/bookingWidgetCalendar");
  assert.ok(calendar.getDisplaySlots("2099-11-04").every(slot => slot.available === false));
  assert.deepEqual(calendar.getDisplaySlots("2099-11-04", []), []);
});

test("live availability uses the admin's operating hours and custom prices", async () => {
  const query = { select() { return this; }, eq() { return this; }, lt() { return this; }, async gt() { return { data: [], error: null }; } };
  const load = createLoader({
    "@/utils/supabase/admin": { createAdminClient: () => ({ from: () => query }) },
    "@/utils/booking/getBusinessRules": { getBusinessRules: async () => rules },
  });
  const slots = await load("@/utils/booking/bookingAvailability").getAvailableSlots("2099-11-04", courtId);
  assert.deepEqual(slots.map(slot => slot.startHour), [8, 9, 10]);
  assert.ok(slots.every(slot => slot.rate === 375 && slot.available));
});

test("a booking requires a session before any database write", async () => {
  const fixture = bookingFixture({ user: null });
  const result = await fixture.action(bookingForm());
  assert.match(result.error, /guest or Google access/);
  assert.equal(fixture.inserts.length, 0);
  assert.equal(fixture.emails.length, 0);
});

test("a valid multi-hour booking uses current prices and submits atomically", async () => {
  const fixture = bookingFixture();
  const result = await fixture.action(bookingForm());
  assert.equal(result.ok, true);
  assert.equal(fixture.inserts.length, 1);
  const rows = fixture.inserts[0];
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.hourly_rate === 375 && row.downpayment_amount === 187.5 && row.status === "PENDING_REVIEW"));
  assert.equal(rows[0].booking_group_id, rows[1].booking_group_id);
  assert.equal(fixture.emails[0].totalAmount, 750);
});

test("a conflicting booking returns an error without a success email", async () => {
  const fixture = bookingFixture({ conflict: true });
  const result = await fixture.action(bookingForm());
  assert.match(result.error, /no longer available/);
  assert.equal(fixture.emails.length, 0);
});

test("duplicate slots and missing proof are rejected without writes", async () => {
  const fixture = bookingFixture();
  const duplicate = await fixture.action(bookingForm({ selections: JSON.stringify([{ courtId, startHour: 9 }, { courtId, startHour: 9 }]) }));
  assert.match(duplicate.error, /duplicated/);
  const missing = await fixture.action(bookingForm({ paymentProofUrl: "", paymentProofPublicId: "" }));
  assert.ok(missing.error);
  assert.equal(fixture.inserts.length, 0);
});
