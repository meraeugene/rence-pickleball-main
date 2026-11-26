import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const loadDependency = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const COURT_1 = "00000000-0000-0000-0000-000000000001";
const COURT_2 = "00000000-0000-0000-0000-000000000002";
const ADMIN = { id: "admin", email: "unorally2026@gmail.com" };

function createLoader(mocks = {}) {
  const cache = new Map();
  function load(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "server-only") return {};
    if (!name.startsWith("@/")) return loadDependency(name);
    const file = path.join(root, "src", name.slice(2) + ".ts");
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} };
    cache.set(file, loadedModule);
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function("require", "module", "exports", output)(load, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

// Minimal in-memory stand-in for the Supabase query builder.
function fakeDatabase(tables) {
  const log = [];
  function query(table) {
    const state = { table, op: "select", filters: [], payload: null };
    const run = () => {
      log.push({ ...state });
      const rows = tables[table] || (tables[table] = []);
      const match = (row) =>
        state.filters.every(([kind, column, value]) => {
          if (kind === "eq") return row[column] === value;
          if (kind === "in") return value.includes(row[column]);
          if (kind === "lt") return row[column] < value;
          if (kind === "gt") return row[column] > value;
          return true;
        });
      if (state.op === "insert") {
        const list = Array.isArray(state.payload) ? state.payload : [state.payload];
        for (const row of list) rows.push({ id: crypto.randomUUID(), ...row });
        return { data: list, error: null };
      }
      if (state.op === "update") {
        const hit = rows.filter(match);
        for (const row of hit) Object.assign(row, state.payload);
        return { data: hit.map((row) => ({ id: row.id })), error: null };
      }
      if (state.op === "delete") {
        const keep = rows.filter((row) => !match(row));
        tables[table] = keep;
        return { data: null, error: null };
      }
      return { data: rows.filter(match), error: null };
    };
    const builder = {
      select() { return builder; },
      insert(payload) { state.op = "insert"; state.payload = payload; return builder; },
      update(payload) { state.op = "update"; state.payload = payload; return builder; },
      delete() { state.op = "delete"; return builder; },
      eq(column, value) { state.filters.push(["eq", column, value]); return builder; },
      in(column, value) { state.filters.push(["in", column, value]); return builder; },
      lt(column, value) { state.filters.push(["lt", column, value]); return builder; },
      gt(column, value) { state.filters.push(["gt", column, value]); return builder; },
      order() { return builder; },
      limit() { return builder; },
      maybeSingle: async () => { const result = run(); return { data: result.data?.[0] || null, error: null }; },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return builder;
  }
  return { client: { from: query, rpc: async () => ({ data: 0, error: null }) }, log, tables };
}

function loadAction(modulePath, exportName, { user = ADMIN, tables = {} } = {}) {
  const db = fakeDatabase({
    courts: [{ id: COURT_1, name: "Court 1" }, { id: COURT_2, name: "Court 2" }],
    bookings: [],
    expenses: [],
    recurring_expenses: [],
    ...tables,
  });
  const load = createLoader({
    "next/cache": { revalidatePath() {}, unstable_cache: (fn) => fn },
    "@/utils/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    "@/utils/supabase/admin": { createAdminClient: () => db.client },
  });
  const rules = load("@/lib/pricing");
  const businessRules = {
    settings: { openHour: 8, closeHour: 25, timezone: "Asia/Manila" },
    courts: [{ id: COURT_1, name: "Court 1", description: "Indoor" }, { id: COURT_2, name: "Court 2", description: "Indoor" }],
    pricingBands: rules.DEFAULT_PRICING_BANDS,
  };
  const loadWithRules = createLoader({
    "next/cache": { revalidatePath() {}, unstable_cache: (fn) => fn },
    "@/utils/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    "@/utils/supabase/admin": { createAdminClient: () => db.client },
    "@/utils/booking/getBusinessRules": { getBusinessRules: async () => businessRules },
  });
  return { action: loadWithRules(modulePath)[exportName], load: loadWithRules, db };
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

// ---------- Pricing ----------

test("hourly rates: 8am-3pm 300, 3pm-10pm 350, 10pm-1am 380", () => {
  const { getHourlyRate } = createLoader()("@/lib/pricing");
  const expected = { 8: 300, 11: 300, 14: 300, 15: 350, 18: 350, 21: 350, 22: 380, 23: 380, 24: 380 };
  for (const [hour, rate] of Object.entries(expected)) {
    assert.equal(getHourlyRate(Number(hour)), rate, `start hour ${hour}`);
  }
});

test("pricing bands cover 8am to 1am with no gaps or overlaps", () => {
  const { DEFAULT_PRICING_BANDS } = createLoader()("@/lib/pricing");
  const sorted = [...DEFAULT_PRICING_BANDS].sort((a, b) => a.startHour - b.startHour);
  assert.equal(sorted[0].startHour, 8);
  assert.equal(sorted.at(-1).endHour, 25);
  for (let index = 1; index < sorted.length; index += 1) {
    assert.equal(sorted[index].startHour, sorted[index - 1].endHour);
  }
});

test("SQL seeds and migration match the new rates", () => {
  const files = ["supabase/full-schema.sql", "supabase/schema.sql", "supabase/migrations/20261125030000_update_pricing_bands.sql"];
  for (const file of files) {
    const sql = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(sql, /\('Day', 8, 15, 300/, file);
    assert.match(sql, /\('Evening', 15, 22, 350/, file);
    assert.match(sql, /\('Late Night', 22, 25, 380/, file);
  }
});

// ---------- Admin custom (onsite) booking ----------

const FUTURE = "2099-12-01";

test("admin custom booking saves accepted rows priced across rate bands", async () => {
  const { action, db } = loadAction("@/actions/bookings/createOnsiteBooking", "createOnsiteBooking");
  const result = await action(form({
    date: FUTURE,
    schedules: JSON.stringify([
      { courtId: COURT_1, startHour: 14, endHour: 16 }, // 300 + 350
      { courtId: COURT_2, startHour: 21, endHour: 25 }, // 350 + 380 * 3
    ]),
    customerName: "Walk In",
    customerContact: "09170000000",
    paymentStatus: "HALF_PAID",
  }));
  assert.deepEqual(result, { ok: true });
  const rows = db.tables.bookings;
  assert.equal(rows.length, 2);
  const court1 = rows.find((row) => row.court_id === COURT_1);
  const court2 = rows.find((row) => row.court_id === COURT_2);
  assert.equal(court1.total_amount, 650);
  assert.equal(court1.hourly_rate, 300);
  assert.equal(court1.downpayment_amount, 325);
  assert.equal(court2.total_amount, 350 + 380 * 3);
  assert.equal(court2.status, "ACCEPTED");
  assert.equal(court2.payment_method, "ONSITE");
  assert.equal(court1.booking_group_id, court2.booking_group_id);
  assert.equal(court1.start_at, "2099-12-01T06:00:00.000Z");
});

test("admin custom booking rejects non-admins, overlaps, past times and booked slots", async () => {
  const base = {
    date: FUTURE,
    customerName: "Walk In",
    customerContact: "09170000000",
    paymentStatus: "PAID",
  };

  const guest = loadAction("@/actions/bookings/createOnsiteBooking", "createOnsiteBooking", { user: { id: "x", email: "someone@example.com" } });
  assert.equal((await guest.action(form({ ...base, schedules: JSON.stringify([{ courtId: COURT_1, startHour: 9, endHour: 10 }]) }))).error, "Unauthorized.");
  assert.equal(guest.db.tables.bookings.length, 0);

  const overlap = loadAction("@/actions/bookings/createOnsiteBooking", "createOnsiteBooking");
  const overlapResult = await overlap.action(form({ ...base, schedules: JSON.stringify([
    { courtId: COURT_1, startHour: 9, endHour: 11 },
    { courtId: COURT_1, startHour: 10, endHour: 12 },
  ]) }));
  assert.equal(overlapResult.ok, false);
  assert.match(overlapResult.error, /overlap/);

  const late = loadAction("@/actions/bookings/createOnsiteBooking", "createOnsiteBooking");
  const lateResult = await late.action(form({ ...base, schedules: JSON.stringify([{ courtId: COURT_1, startHour: 24, endHour: 26 }]) }));
  assert.match(lateResult.error, /operating hours/);

  const past = loadAction("@/actions/bookings/createOnsiteBooking", "createOnsiteBooking");
  const pastResult = await past.action(form({ ...base, date: "2020-01-01", schedules: JSON.stringify([{ courtId: COURT_1, startHour: 9, endHour: 10 }]) }));
  assert.match(pastResult.error, /future/);

  const taken = loadAction("@/actions/bookings/createOnsiteBooking", "createOnsiteBooking", {
    tables: { bookings: [{ id: "b1", court_id: COURT_1, status: "ACCEPTED", start_at: "2099-12-01T01:00:00.000Z", end_at: "2099-12-01T03:00:00.000Z" }] },
  });
  const takenResult = await taken.action(form({ ...base, schedules: JSON.stringify([{ courtId: COURT_1, startHour: 10, endHour: 11 }]) }));
  assert.match(takenResult.error, /already booked/);
  assert.equal(taken.db.tables.bookings.length, 1);
});

// ---------- Expenses ----------

test("add, edit and delete an expense", async () => {
  const { load, db } = loadAction("@/actions/admin/manageExpenses", "createExpense");
  const { createExpense, updateExpense, deleteExpense } = load("@/actions/admin/manageExpenses");

  const created = await createExpense(form({ expenseDate: "2026-11-20", category: "UTILITIES", description: "Electric bill", amount: "4520.50" }));
  assert.deepEqual(created, { ok: true, message: "Expense added." });
  assert.equal(db.tables.expenses.length, 1);
  const saved = db.tables.expenses[0];
  assert.equal(saved.amount, 4520.5);
  assert.equal(saved.created_by_email, ADMIN.email);

  const updated = await updateExpense(form({ id: saved.id, expenseDate: "2026-11-21", category: "UTILITIES", description: "Electric bill (Nov)", amount: "4600" }));
  assert.equal(updated.ok, true);
  assert.equal(db.tables.expenses[0].description, "Electric bill (Nov)");
  assert.equal(db.tables.expenses[0].amount, 4600);

  const removed = await deleteExpense(saved.id);
  assert.equal(removed.ok, true);
  assert.equal(db.tables.expenses.length, 0);
});

test("expense validation returns field errors and writes nothing", async () => {
  const { load, db } = loadAction("@/actions/admin/manageExpenses", "createExpense");
  const { createExpense } = load("@/actions/admin/manageExpenses");
  const result = await createExpense(form({ expenseDate: "bad", category: "NOPE", description: " ", amount: "-5" }));
  assert.equal(result.ok, false);
  assert.ok(result.fieldErrors.expenseDate);
  assert.ok(result.fieldErrors.category);
  assert.ok(result.fieldErrors.description);
  assert.ok(result.fieldErrors.amount);
  const decimals = await createExpense(form({ expenseDate: "2026-11-20", category: "RENT", description: "Rent", amount: "10.555" }));
  assert.equal(decimals.fieldErrors.amount, "Use at most 2 decimal places.");
  assert.equal(db.tables.expenses.length, 0);
});

test("recurring expense saves a monthly rule", async () => {
  const { load, db } = loadAction("@/actions/admin/manageExpenses", "createExpense");
  const { createExpense, setRecurringExpenseActive, deleteRecurringExpense } = load("@/actions/admin/manageExpenses");
  const result = await createExpense(form({ expenseDate: "2026-12-05", category: "RENT", description: "Venue rent", amount: "25000", repeatMonthly: "true" }));
  assert.equal(result.ok, true);
  const rule = db.tables.recurring_expenses[0];
  assert.equal(rule.day_of_month, 5);
  assert.equal(rule.start_month, "2026-12-01");
  assert.equal(db.tables.expenses.length, 0);

  assert.equal((await setRecurringExpenseActive(rule.id, false)).ok, true);
  assert.equal(db.tables.recurring_expenses[0].active, false);
  assert.equal((await deleteRecurringExpense(rule.id)).ok, true);
  assert.equal(db.tables.recurring_expenses.length, 0);
});

test("non-admins cannot change expenses", async () => {
  const { load, db } = loadAction("@/actions/admin/manageExpenses", "createExpense", { user: { id: "x", email: "someone@example.com" } });
  const { createExpense } = load("@/actions/admin/manageExpenses");
  const result = await createExpense(form({ expenseDate: "2026-11-20", category: "RENT", description: "Rent", amount: "100" }));
  assert.equal(result.error, "Unauthorized.");
  assert.equal(db.tables.expenses.length, 0);
});

// ---------- Accepting a booking ----------

test("accepting a pending booking stamps the reviewer on the whole group", async () => {
  const group = "11111111-1111-4111-8111-111111111111";
  const { action, db } = loadAction("@/actions/bookings/acceptBooking", "acceptBooking", {
    tables: {
      bookings: [
        { id: "b1", booking_group_id: group, status: "ACCEPTED", start_at: "a", end_at: "b", total_amount: 300, user_email: null, customer_name: "X", courts: { name: "Court 1" } },
        { id: "b2", booking_group_id: group, status: "ACCEPTED", start_at: "b", end_at: "c", total_amount: 350, user_email: null, customer_name: "X", courts: { name: "Court 1" } },
      ],
    },
  });
  db.client.rpc = async (name) => {
    assert.equal(name, "accept_pending_booking");
    return { data: [{ accepted: true, conflict: false }], error: null };
  };
  const result = await action(form({ bookingId: "b1" }));
  assert.deepEqual(result, { ok: true });
  assert.ok(db.tables.bookings.every((row) => row.reviewed_by_email === ADMIN.email));
});

test("accepting reports a slot conflict instead of double-booking", async () => {
  const { action, db } = loadAction("@/actions/bookings/acceptBooking", "acceptBooking", {
    tables: { bookings: [{ id: "b1", booking_group_id: "g" }] },
  });
  db.client.rpc = async () => ({ data: [{ accepted: false, conflict: true }], error: null });
  assert.equal((await action(form({ bookingId: "b1" }))).error, "This slot is already reserved.");
});

// ---------- Payment update ----------

test("payment update validates amount and maps database errors", async () => {
  const id = "22222222-2222-4222-8222-222222222222";
  const { action, db } = loadAction("@/actions/bookings/updateBookingPayment", "updateBookingPayment");
  assert.equal((await action(form({ bookingId: id, additionalAmount: "-1" }))).ok, false);
  db.client.rpc = async (_name, args) => {
    assert.equal(args.p_additional_amount, 200);
    return { data: [{ amount_paid: 500, total_amount: 650, payment_status: "HALF_PAID" }], error: null };
  };
  assert.deepEqual(await action(form({ bookingId: id, additionalAmount: "200" })), {
    ok: true, amountPaid: 500, totalAmount: 650, paymentStatus: "HALF_PAID",
  });
  db.client.rpc = async () => ({ data: null, error: { message: "booking_payment_exceeds_balance" } });
  assert.equal((await action(form({ bookingId: id, additionalAmount: "999" }))).error, "The payment exceeds the remaining balance.");
});

// ---------- Excel export ----------

test("profit report exports a valid Excel workbook", async () => {
  const { action } = loadAction("@/actions/admin/exportProfitReport", "exportProfitReport");
  const result = await action({
    periodLabel: "November 2026",
    periodStart: "2026-11-01",
    periodEnd: "2026-11-30",
    groupingLabel: "Daily",
    summary: { revenue: 10000, bookingValue: 12000, outstanding: 2000, expenses: 4000, profit: 6000, bookings: 12 },
    previous: null,
    trend: [{ label: "Nov 1", start: "2026-11-01", end: "2026-11-01", revenue: 10000, expenses: 4000, profit: 6000 }],
    expenses: [{ date: "2026-11-02", category: "Utilities", description: "Power", amount: 4000, recurring: false, loggedBy: ADMIN.email }],
    byCategory: [{ label: "Utilities", amount: 4000 }],
    byCourt: [{ label: "Court 1", collected: 10000, bookingValue: 12000 }],
    bySlot: [{ label: "Day", collected: 10000, bookingValue: 12000 }],
  });
  assert.equal(result.ok, true);
  const ExcelJS = loadDependency("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(result.base64, "base64"));
  assert.ok(workbook.getWorksheet("Summary"));
  assert.match(result.fileName, /\.xlsx$/);
});
