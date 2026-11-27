"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import useSWR, { useSWRConfig } from "swr";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LayoutGrid,
  Loader2,
  Mail,
  Phone,
  ReceiptText,
  Search,
  Table2,
  X,
} from "lucide-react";
import Link from "next/link";
import { AdminWorkspaceNav } from "./AdminWorkspaceNav";
import type { AdminView } from "@/types/admin/adminWorkspace";
import type { Announcement } from "@/types/announcement";
import { useRouter } from "next/navigation";
import { ADMIN_BOOKINGS_PAGE_SIZE } from "@/data/admin/adminPagination";
import { formatPeso } from "@/lib/pricing";
import {
  formatManilaDateTime,
  formatSlotLabel,
  getCalendarOperatingHours,
  manilaHourToUtc,
} from "@/lib/time";
import type {
  BookingSettings,
  CourtOption,
} from "@/types/bookingSettings";
import type {
  AdminBooking,
  AdminBookingFilters,
  AdminBookingsPayload,
  AdminScheduleBooking,
} from "@/types/admin/adminBooking";
import type { ProfitDashboardData } from "@/types/admin/expense";
import type { BookingImportResponse } from "@/types/admin/bookingImport";
import { formatPaymentMethod } from "@/utils/admin/formatPaymentMethod";
import { isExcelImportedBooking } from "@/utils/booking/isExcelImportedBooking";
import { todayInManila } from "@/lib/time";
import { resetBookingData } from "@/actions/admin/resetBookingData";
import { ACCEPTED_BOOKINGS_KEY } from "@/hooks/useAcceptedBookings";
import { USER_BOOKING_HISTORY_KEY } from "@/hooks/useUserBookingHistory";
import { AdminBookingActions } from "./AdminBookingActions";
import { AnnouncementsManager } from "./AnnouncementsManager";
import { BookingBackupRestore } from "./BookingBackupRestore";
import { BookingListImporter } from "./BookingListImporter";
import { OnsiteBookingForm } from "./OnsiteBookingForm";
import { InfoBox } from "./InfoBox";
import { Pagination } from "./Pagination";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { ProfitDashboard } from "./ProfitDashboard";
import { StatusBadge } from "./StatusBadge";

type AdminBookingDashboardProps = {
  adminMutationLockError: string | null;
  announcements: { items: Announcement[]; missingTable: boolean };
  bookingRows: AdminBooking[];
  courts: CourtOption[];
  currentPage: number;
  filters: AdminBookingFilters;
  profitDashboard: ProfitDashboardData | null;
  settings: BookingSettings;
  totalCount: number;
  totalPages: number;
};


type BookingListView = "cards" | "table";

type SchedulePayload = {
  bookings: AdminScheduleBooking[];
};

type ResetBookingDataResult =
  | {
      ok: boolean;
      error?: string;
      deletedCount: number;
    }
  | undefined;

const NEW_BOOKING_WINDOW_MS = 15 * 60 * 1000;

export function AdminBookingDashboard({
  adminMutationLockError,
  announcements,
  bookingRows,
  courts,
  currentPage,
  filters: serverFilters,
  profitDashboard,
  settings,
  totalCount,
  totalPages,
}: AdminBookingDashboardProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [view, setView] = useState<AdminView>("queue");
  const [bookingListView, setBookingListView] =
    useState<BookingListView>("cards");
  const [filters, setFilters] = useState(serverFilters);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(todayInManila());
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const bookingSoundRef = useRef<HTMLAudioElement | null>(null);
  const bookingSoundUnlockedRef = useRef(false);
  const previousTotalCount = useRef(totalCount);
  const adminBookingsKey = buildAdminBookingsKey(filters);
  const previousBookingsKey = useRef(adminBookingsKey);
  const serverBookingsKey = buildAdminBookingsKey(serverFilters);
  const serverFallbackData: AdminBookingsPayload = {
    bookingRows,
    filters: serverFilters,
    safePage: currentPage,
    totalCount,
    totalPages,
  };
  const { data, isValidating } = useSWR<AdminBookingsPayload>(
    adminMutationLockError ? null : adminBookingsKey,
    fetchAdminBookings,
    {
      fallbackData:
        adminBookingsKey === serverBookingsKey
          ? serverFallbackData
          : undefined,
      revalidateOnFocus: true,
      refreshInterval: 10000,
    },
  );
  const scheduleKey = `/api/admin/schedule?date=${scheduleDate}`;
  const {
    data: scheduleData,
    error: scheduleError,
    isLoading: isScheduleLoading,
  } = useSWR<SchedulePayload, Error>(
    view === "schedule" && !adminMutationLockError ? scheduleKey : null,
    fetchSchedule,
    { revalidateOnFocus: true, refreshInterval: 10000 },
  );
  const activeData = data || serverFallbackData;
  const activeBookingRows = activeData.bookingRows;
  const reservedConflictIds = getReservedConflictIds(activeBookingRows);
  const activeCurrentPage = activeData.safePage;
  const activeTotalCount = activeData.totalCount;
  const activeTotalPages = activeData.totalPages;
  const queryString = filtersToQuery(filters, activeCurrentPage);
  const isQueueLoading = !data && isValidating;

  useEffect(() => {
    function syncFiltersFromHistory() {
      setFilters(
        filtersFromSearchParams(new URLSearchParams(window.location.search)),
      );
      setHistoryVersion((current) => current + 1);
    }

    window.addEventListener("popstate", syncFiltersFromHistory);
    return () => window.removeEventListener("popstate", syncFiltersFromHistory);
  }, []);

  useEffect(() => {
    const sound = new Audio("/notif-sound.wav");
    sound.preload = "auto";
    bookingSoundRef.current = sound;

    function unlockBookingSound() {
      if (bookingSoundUnlockedRef.current) return;

      sound.muted = true;
      sound
        .play()
        .then(() => {
          sound.pause();
          sound.currentTime = 0;
          sound.muted = false;
          bookingSoundUnlockedRef.current = true;
        })
        .catch(() => {
          sound.muted = false;
        });
    }

    window.addEventListener("pointerdown", unlockBookingSound);
    window.addEventListener("keydown", unlockBookingSound);

    return () => {
      window.removeEventListener("pointerdown", unlockBookingSound);
      window.removeEventListener("keydown", unlockBookingSound);
      sound.pause();
      bookingSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const filtersChanged = previousBookingsKey.current !== adminBookingsKey;
    const isUnfiltered =
      !filters.status &&
      !filters.courtId &&
      !filters.paymentMethod &&
      !filters.date &&
      !filters.q;

    if (
      !filtersChanged &&
      isUnfiltered &&
      activeTotalCount > previousTotalCount.current
    ) {
      setNotification("New booking submitted.");
      const sound = bookingSoundRef.current;
      if (sound && bookingSoundUnlockedRef.current) {
        sound.currentTime = 0;
        sound.play().catch(() => undefined);
      }
    }
    previousBookingsKey.current = adminBookingsKey;
    previousTotalCount.current = activeTotalCount;
  }, [activeTotalCount, adminBookingsKey, filters]);

  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(Date.now());
    updateCurrentTime();
    const interval = window.setInterval(updateCurrentTime, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  function updateBookingListView(nextView: BookingListView) {
    setBookingListView(nextView);
  }

  const firstVisible = activeTotalCount
    ? (activeCurrentPage - 1) * ADMIN_BOOKINGS_PAGE_SIZE + 1
    : 0;
  const lastVisible = Math.min(
    activeCurrentPage * ADMIN_BOOKINGS_PAGE_SIZE,
    activeTotalCount,
  );

  const pushFilters = useCallback(
    (nextFilters: AdminBookingFilters) => {
      setFilters(nextFilters);
      const next = new URLSearchParams();
      for (const [key, item] of Object.entries(nextFilters)) {
        if (key === "page") continue;
        if (item) next.set(key, String(item));
      }
      window.history.replaceState(
        null,
        "",
        `/admin${next.toString() ? `?${next.toString()}` : ""}`,
      );
    },
    [],
  );

  const updateFilter = useCallback(
    (name: keyof AdminBookingFilters, value: string) => {
      pushFilters({ ...filters, [name]: value, page: 1 });
    },
    [filters, pushFilters],
  );

  const changePage = useCallback(
    (page: number) => {
      const nextFilters = { ...filters, page };
      setFilters(nextFilters);
      window.history.pushState(
        null,
        "",
        `/admin?${filtersToQuery(nextFilters, page)}`,
      );
    },
    [filters],
  );

  async function refreshAdminData() {
    await Promise.all([
      mutate(adminBookingsKey),
      mutate(scheduleKey),
      mutate("/api/admin/notifications"),
    ]);
    router.refresh();
  }

  async function resetBookings(formData: FormData) {
    const result = await resetBookingData(formData);

    if (result?.ok) {
      await Promise.all([
        mutate(adminBookingsKey),
        mutate("/api/admin/bookings?page=1"),
        mutate(scheduleKey),
        mutate("/api/admin/notifications"),
        mutate(ACCEPTED_BOOKINGS_KEY),
        mutate(USER_BOOKING_HISTORY_KEY),
      ]);
      setNotification(`Reset complete. Deleted ${result.deletedCount} bookings.`);
      router.push("/admin");
      router.refresh();
    }

    return result;
  }

  return (
    <main className="modern-admin min-h-screen bg-black px-4 py-6 text-white sm:px-5 lg:px-8 lg:py-8">
      {notification ? (
        <div className="fixed right-4 top-4 z-50 flex max-w-xs items-center gap-3 rounded-xl border border-lime-300/25 bg-zinc-950 px-4 py-3 text-sm text-lime-100 shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
          <Bell className="h-4 w-4 shrink-0 text-lime-200" />
          <span>{notification}</span>
        </div>
      ) : null}

      <div className="admin-workspace mx-auto w-full max-w-[1600px]">
        <div className="modern-admin-header flex min-w-0 flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.12em] text-zinc-400">
              UNO RALLY
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
              Admin Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Bookings, schedule, and finances in one place.
            </p>
          </div>
          <Link
            className="premium-button h-12 w-full cursor-pointer rounded-xl px-5 font-display text-xs font-bold uppercase tracking-[0.12em] sm:w-auto lg:h-10 lg:min-h-10 lg:px-4 lg:text-xs"
            href="/"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </Link>
        </div>

        <AdminWorkspaceNav
          view={view}
          onSelect={(nextView) => {
            setView(nextView);
            if (nextView === "expenses" || nextView === "announcements") router.refresh();
          }}
        />
        <div className="modern-admin-content">
        {view === "queue" ? (
          <section className="mt-8">
            {adminMutationLockError ? (
              <AdminDatabaseMaintenanceNotice
                message={adminMutationLockError}
              />
            ) : (
              <>
            <AdminFilters
              courts={courts}
              key={historyVersion}
              filters={filters}
              onChange={updateFilter}
              onClear={() =>
                pushFilters({
                  courtId: "",
                  date: "",
                  page: 1,
                  paymentMethod: "",
                  q: "",
                  status: "",
                })
              }
            />
            <div className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
                  Bookings
                </p>
                <h2 className="mt-2 truncate font-display text-lg font-bold">
                  All reservations
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <BookingListViewToggle
                  value={bookingListView}
                  onChange={updateBookingListView}
                />
                <p className="w-fit shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                  {activeTotalCount} total
                  {activeTotalCount > 0 ? (
                    <span className="ml-1 text-zinc-400">
                      ({firstVisible}-{lastVisible})
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            {isQueueLoading ? (
              bookingListView === "cards" ? (
                <div className="mt-5 grid gap-3 xl:grid-cols-2">
                  <BookingCardSkeleton />
                  <BookingCardSkeleton />
                </div>
              ) : (
                <BookingTableSkeleton />
              )
            ) : activeBookingRows.length ? (
              bookingListView === "cards" ? (
                <div className="mt-5 grid gap-3 xl:grid-cols-2">
                  {activeBookingRows.map((booking) => (
                    <BookingCard
                      adminBookingsKey={adminBookingsKey}
                      booking={booking}
                      courts={courts}
                      currentTime={currentTime}
                      currentPage={activeCurrentPage}
                      hasReservedConflict={reservedConflictIds.has(booking.id)}
                      key={booking.id}
                      onRefresh={refreshAdminData}
                      settings={settings}
                    />
                  ))}
                </div>
              ) : (
                <BookingTable
                  adminBookingsKey={adminBookingsKey}
                  bookings={activeBookingRows}
                  courts={courts}
                  currentTime={currentTime}
                  currentPage={activeCurrentPage}
                  reservedConflictIds={reservedConflictIds}
                  onRefresh={refreshAdminData}
                  settings={settings}
                />
              )
            ) : (
              <p className="mt-5 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-10 text-center text-sm text-zinc-400">
                No bookings match these filters.
              </p>
            )}

            {activeTotalPages > 1 ? (
              <Pagination
                currentPage={activeCurrentPage}
                onPageChange={changePage}
                pending={isQueueLoading}
                queryString={queryString}
                totalPages={activeTotalPages}
              />
            ) : null}
              </>
            )}
          </section>
        ) : null}

        {view === "schedule" ? (
          adminMutationLockError ? (
            <section className="mt-8">
              <AdminDatabaseMaintenanceNotice
                message={adminMutationLockError}
              />
            </section>
          ) : (
            <ScheduleView
              adminMutationLockError={adminMutationLockError}
              bookings={scheduleData?.bookings || []}
              courts={courts}
              date={scheduleDate}
              error={scheduleError?.message || null}
              isLoading={isScheduleLoading}
              settings={settings}
              onDateChange={setScheduleDate}
              onImported={async (result) => {
                if (result.firstImportedDate) {
                  setScheduleDate(result.firstImportedDate);
                }
                await refreshAdminData();
                setNotification(
                  `Imported ${result.importedCount} bookings from Excel.`,
                );
              }}
              onOnsiteAdded={async () => {
                await refreshAdminData();
                setNotification("Onsite booking added to the schedule.");
              }}
            />
          )
        ) : null}

        {view === "expenses" && profitDashboard ? (
          <ProfitDashboard
            data={profitDashboard}
            lockError={adminMutationLockError}
          />
        ) : null}

        {view === "announcements" ? (
          <AnnouncementsManager
            items={announcements.items}
            lockError={adminMutationLockError}
            missingTable={announcements.missingTable}
          />
        ) : null}

        {view === "backup" ? (
          <BookingBackupRestore
            lockError={adminMutationLockError}
            onRestored={async () => {
              await refreshAdminData();
              setNotification("Booking backup restored.");
            }}
          />
        ) : null}

        {view === "reset" ? (
          <ResetDataPanel
            bookingCount={activeTotalCount}
            onReset={resetBookings}
          />
        ) : null}
        </div>
      </div>
    </main>
  );
}

function AdminFilters({
  courts,
  filters,
  onClear,
  onChange,
}: {
  courts: CourtOption[];
  filters: AdminBookingFilters;
  onClear: () => void;
  onChange: (name: keyof AdminBookingFilters, value: string) => void;
}) {
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => {
    if (draftFilters.q === filters.q) return;
    const timeout = window.setTimeout(() => {
      onChange("q", draftFilters.q);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [draftFilters.q, filters.q, onChange]);

  function updateImmediate(name: keyof AdminBookingFilters, value: string) {
    const next = { ...draftFilters, [name]: value, page: 1 };
    setDraftFilters(next);
    onChange(name, value);
  }

  function clearFilters() {
    setDraftFilters({
      courtId: "",
      date: "",
      page: 1,
      paymentMethod: "",
      q: "",
      status: "",
    });
    onClear();
  }

  return (
    <div className="relative grid gap-3 rounded-2xl border border-white/10 bg-zinc-950 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-5">
      <label className="relative min-w-0 sm:col-span-2 lg:col-span-2">
        <span className="sr-only">Search bookings</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        />
        <input
          aria-label="Search bookings"
          autoComplete="off"
          className="h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black pl-10 pr-10 text-sm text-white outline-none transition placeholder:text-zinc-400 hover:bg-white/[0.04] focus:border-white/35"
          enterKeyHint="search"
          placeholder="Search by name, email, phone, or reference"
          role="searchbox"
          spellCheck={false}
          type="text"
          value={draftFilters.q}
          onChange={(event) =>
            setDraftFilters((current) => ({
              ...current,
              page: 1,
              q: event.target.value,
            }))
          }
        />
        {draftFilters.q ? (
          <button
            aria-label="Clear booking search"
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
            type="button"
            onClick={() =>
              setDraftFilters((current) => ({ ...current, page: 1, q: "" }))
            }
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </label>
      <select
        className="h-11 w-full min-w-0 cursor-pointer rounded-xl border border-white/10 bg-black px-3 text-sm text-white transition focus:border-white/35"
        value={draftFilters.status}
        onChange={(event) => updateImmediate("status", event.target.value)}
      >
        <option value="">All statuses</option>
        <option value="PENDING_REVIEW">Pending</option>
        <option value="ACCEPTED">Accepted</option>
        <option value="REJECTED">Rejected</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      <select
        className="h-11 w-full min-w-0 cursor-pointer rounded-xl border border-white/10 bg-black px-3 text-sm text-white transition focus:border-white/35"
        value={draftFilters.courtId}
        onChange={(event) => updateImmediate("courtId", event.target.value)}
      >
        <option value="">All courts</option>
        {courts.map((court) => (
          <option key={court.id} value={court.id}>
            {court.name}
          </option>
        ))}
      </select>
      <input
        aria-label="Filter bookings by date"
        className="admin-date-input h-11 w-full min-w-0 max-w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none transition hover:bg-white/[0.04] focus:border-white/35"
        type="date"
        value={draftFilters.date}
        onChange={(event) => updateImmediate("date", event.target.value)}
      />
      <select
        className="h-11 w-full min-w-0 cursor-pointer rounded-xl border border-white/10 bg-black px-3 text-sm text-white transition focus:border-white/35 lg:col-span-2"
        value={draftFilters.paymentMethod}
        onChange={(event) =>
          updateImmediate("paymentMethod", event.target.value)
        }
      >
        <option value="">All payment methods</option>
        <option value="BPI">BPI</option>
        <option value="GOTYME">GoTyme</option>
        <option value="ONSITE">Onsite</option>
      </select>
      <button
        className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-zinc-200 transition hover:border-white/30 hover:bg-white/[0.09] hover:text-white"
        type="button"
        onClick={clearFilters}
      >
        Clear filters
      </button>
    </div>
  );
}

function AdminDatabaseMaintenanceNotice({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] px-5 py-12 text-center"
      role="status"
    >
      <Loader2 className="h-8 w-8 animate-spin text-amber-200" />
      <p className="mt-5 font-display text-sm font-bold uppercase tracking-[0.18em] text-amber-100">
        Admin maintenance in progress
      </p>
      <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
        {message}
      </p>
      <p className="mt-2 text-xs text-zinc-400">
        Bookings are temporarily unavailable. Please check back shortly.
      </p>
    </div>
  );
}

function BookingListViewToggle({
  onChange,
  value,
}: {
  onChange: (view: BookingListView) => void;
  value: BookingListView;
}) {
  return (
    <div
      aria-label="Booking layout"
      className="inline-flex rounded-lg border border-white/10 bg-zinc-950 p-1"
      role="group"
    >
      <button
        aria-pressed={value === "cards"}
        className={bookingListViewButtonClass(value === "cards")}
        type="button"
        onClick={() => onChange("cards")}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Cards
      </button>
      <button
        aria-pressed={value === "table"}
        className={bookingListViewButtonClass(value === "table")}
        type="button"
        onClick={() => onChange("table")}
      >
        <Table2 className="h-3.5 w-3.5" />
        Table
      </button>
    </div>
  );
}

function bookingListViewButtonClass(active: boolean) {
  return [
    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-bold transition",
    active
      ? "bg-white text-black shadow-sm"
      : "text-zinc-400 hover:bg-white/[0.06] hover:text-white",
  ].join(" ");
}

function BookingTable({
  adminBookingsKey,
  bookings,
  courts,
  currentPage,
  currentTime,
  onRefresh,
  reservedConflictIds,
  settings,
}: {
  adminBookingsKey: string;
  bookings: AdminBooking[];
  courts: CourtOption[];
  currentPage: number;
  currentTime: number | null;
  onRefresh: () => Promise<void>;
  reservedConflictIds: Set<string>;
  settings: BookingSettings;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-[0_18px_48px_rgba(0,0,0,0.32)]">
      <p className="border-b border-white/10 bg-white/[0.025] px-4 py-2 text-xs font-semibold text-zinc-400 lg:hidden">
        Swipe sideways to see more details.
      </p>
      <div
        aria-label="Scrollable bookings table"
        className="overflow-x-auto overscroll-x-contain"
        role="region"
        tabIndex={0}
      >
        <table className="w-full min-w-[960px] table-fixed border-collapse text-left lg:min-w-full">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[23%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[13%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="border-b border-white/10 bg-white/[0.035]">
            <tr className="font-display text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
              <th className="px-3 py-3" scope="col">Customer</th>
              <th className="px-3 py-3" scope="col">Schedule</th>
              <th className="px-3 py-3" scope="col">Payment</th>
              <th className="px-3 py-3" scope="col">Proof</th>
              <th className="px-3 py-3" scope="col">Status</th>
              <th className="px-3 py-3" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.07]">
            {bookings.map((booking) => {
              const newBookingLabel = getNewBookingLabel(booking, currentTime);
              const isImported = isExcelImportedBooking(booking);

              return (
                <tr className="align-top transition hover:bg-white/[0.025]" key={booking.id}>
                  <td className="px-3 py-4">
                    <p className="whitespace-nowrap text-sm font-bold text-white">
                      {booking.customer_name}
                    </p>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-zinc-400">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{booking.user_email || "Guest - no email"}</span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      {booking.customer_contact}
                    </p>
                    <p className="mt-1.5 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs text-zinc-400">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      <span className="whitespace-nowrap">
                        {isImported ? "Date imported" : "Date booked"}: {formatCreatedAt(booking.created_at)}
                      </span>
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <div className="grid gap-2">
                      {(booking.schedule || []).map((slot) => (
                        <div key={slot.id}>
                          <p className="text-xs font-bold text-white">{slot.courtName}</p>
                          <p className="mt-0.5 text-xs leading-5 text-zinc-400">
                            {formatManilaDateTime(slot.startAt)}
                            <span className="whitespace-nowrap">
                              {" – "}{formatManilaTime(slot.endAt)}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <p className="text-xs font-semibold text-zinc-300">
                      {formatPaymentMethod(booking.payment_method)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {formatPeso(booking.downpayment_amount)}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      of {formatPeso(booking.total_amount)}
                    </p>
                    <div className="mt-2">
                      <PaymentStatusBadge status={booking.payment_status} />
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <p className="truncate text-xs text-zinc-400">
                      {booking.payment_reference || "No reference"}
                    </p>
                    {booking.payment_proof_url ? (
                      <Link
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-lime-200 transition hover:text-lime-100"
                        href={booking.payment_proof_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        View proof
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-400">No upload</p>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <div className="grid justify-items-start gap-2">
                      <StatusBadge status={booking.status} />
                      {newBookingLabel ? (
                        <span className="whitespace-nowrap rounded-full border border-cyan-300/35 bg-cyan-300/10 px-2 py-1 text-xs font-bold uppercase tracking-[0.1em] text-cyan-100">
                          {newBookingLabel}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <AdminBookingActions
                      adminBookingsKey={adminBookingsKey}
                      amountPaid={booking.downpayment_amount}
                      bookingId={booking.id}
                      compact
                      courts={courts}
                      currentPage={currentPage}
                      hasReservedConflict={reservedConflictIds.has(booking.id)}
                      schedule={booking.schedule || []}
                      settings={settings}
                      status={booking.status}
                      totalAmount={booking.total_amount}
                      onRefresh={onRefresh}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookingTableSkeleton() {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
      <div className="h-8 border-b border-white/10 bg-white/[0.025] lg:hidden" />
      <div className="overflow-x-auto">
        <div className="min-w-[960px] animate-pulse lg:min-w-full">
          <div className="h-11 border-b border-white/10 bg-white/[0.035]" />
          {Array.from({ length: 3 }, (_, row) => (
            <div
              className="grid grid-cols-[1.25fr_1.5fr_0.9fr_0.8fr_0.8fr_1.6fr] gap-6 border-b border-white/[0.07] px-4 py-4 last:border-b-0"
              key={row}
            >
              {Array.from({ length: 6 }, (_, column) => (
                <div className="space-y-2" key={column}>
                  <div className="h-3 w-24 rounded bg-white/[0.08]" />
                  <div className="h-3 w-32 rounded bg-white/[0.05]" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookingCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.32)]">
      <div className="animate-pulse">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-5 w-36 rounded bg-white/[0.08]" />
              <div className="h-7 w-24 rounded-full bg-white/[0.06]" />
            </div>
            <div className="mt-3 h-3 w-52 max-w-full rounded bg-white/[0.06]" />
            <div className="mt-2 h-3 w-32 rounded bg-white/[0.06]" />
          </div>
          <div className="h-20 w-full rounded-lg border border-white/10 bg-white/[0.04] sm:w-28" />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className="rounded-lg border border-white/10 bg-white/[0.035] p-3"
              key={index}
            >
              <div className="h-3 w-16 rounded bg-white/[0.06]" />
              <div className="mt-3 h-4 w-28 rounded bg-white/[0.08]" />
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 rounded-xl border border-white/10 bg-black/35 p-3 sm:grid-cols-[1fr_10rem]">
          <div>
            <div className="h-3 w-36 rounded bg-white/[0.06]" />
            <div className="mt-3 h-4 w-44 max-w-full rounded bg-white/[0.08]" />
          </div>
          <div className="h-24 rounded-lg border border-white/10 bg-white/[0.04]" />
        </div>

        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="h-14 rounded-lg border border-white/10 bg-white/[0.04]" />
        </div>
      </div>
    </article>
  );
}

function BookingCard({
  adminBookingsKey,
  booking,
  courts,
  currentTime,
  currentPage,
  hasReservedConflict,
  onRefresh,
  settings,
}: {
  adminBookingsKey: string;
  booking: AdminBooking;
  courts: CourtOption[];
  currentTime: number | null;
  currentPage: number;
  hasReservedConflict: boolean;
  onRefresh: () => Promise<void>;
  settings: BookingSettings;
}) {
  const newBookingLabel = getNewBookingLabel(booking, currentTime);
  const isImported = isExcelImportedBooking(booking);

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.32)]">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="grid min-w-0 justify-items-start gap-2">
            <h3 className="max-w-full whitespace-nowrap text-base font-bold text-white">
              {booking.customer_name}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={booking.status} />
              <PaymentStatusBadge status={booking.payment_status} />
              {newBookingLabel ? (
                <span className="inline-flex w-fit items-center rounded-full border border-cyan-300/35 bg-cyan-300/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-cyan-100">
                  {newBookingLabel}
                </span>
              ) : null}
            </div>
          </div>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-zinc-400">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{booking.user_email || "Guest - no email"}</span>
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-zinc-300">
            <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <span className="truncate">{booking.customer_contact}</span>
          </p>
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-zinc-400">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {isImported ? "Date imported" : "Date booked"}: {formatCreatedAt(booking.created_at)}
            </span>
          </p>
        </div>
        <div className={`grid w-full shrink-0 grid-cols-2 items-center gap-2 rounded-lg border px-3 py-2 text-left sm:block sm:w-auto sm:min-w-28 sm:text-right ${booking.payment_status === "PAID" ? "border-lime-300/30 bg-lime-300/[0.09]" : "border-white/10 bg-white/[0.04]"}`}>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
            Pay
          </p>
          <p className="text-right text-lg font-bold text-white sm:text-inherit">
            {formatPeso(booking.downpayment_amount)}
          </p>
          <p className="col-span-2 text-xs text-zinc-400">
            of {formatPeso(booking.total_amount)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <InfoBox label="Method" value={formatPaymentMethod(booking.payment_method)} />
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
              Selected schedule
            </p>
            <span className="text-xs text-zinc-400">
              {booking.schedule?.length || 1} slot{booking.schedule?.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {(booking.schedule || []).map((slot) => (
              <div
                className="grid min-w-0 gap-1 rounded-lg border border-white/[0.07] bg-black/35 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                key={slot.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-white">{slot.courtName}</p>
                  <p className="mt-1 text-zinc-400">
                    {formatManilaDateTime(slot.startAt)} – {formatManilaDateTime(slot.endAt)}
                  </p>
                </div>
                <p className="font-bold text-zinc-300">{formatPeso(slot.totalAmount)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 rounded-xl border border-white/10 bg-black/35 p-3 sm:grid-cols-[1fr_10rem] sm:items-stretch">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-400">
            <ReceiptText className="h-4 w-4" />
            <span className="truncate">Payment proof</span>
          </div>
          <p className="mt-2 truncate text-sm text-zinc-300">
            Ref: {booking.payment_reference || "No reference"}
          </p>
        </div>
        {booking.payment_proof_url ? (
          <Link
            className="block min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]"
            href={booking.payment_proof_url}
            target="_blank"
          >
            <span
              aria-hidden="true"
              className="block aspect-[16/10] bg-cover bg-center sm:aspect-auto sm:h-full"
              style={{ backgroundImage: `url(${booking.payment_proof_url})` }}
            />
            <span className="flex min-w-0 items-center justify-center gap-2 border-t border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300">
              <span className="truncate">Preview proof</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </span>
          </Link>
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-xs text-zinc-400 sm:grid sm:place-items-center">
            No proof uploaded
          </p>
        )}
      </div>

      {/* {booking.review_reason ? (
        <p className="mt-3 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-zinc-400">
          {booking.review_reason}
        </p>
      ) : null} */}

      <div className="mt-3 border-t border-white/10 pt-3">
        <AdminBookingActions
          adminBookingsKey={adminBookingsKey}
          amountPaid={booking.downpayment_amount}
          bookingId={booking.id}
          courts={courts}
          currentPage={currentPage}
          hasReservedConflict={hasReservedConflict}
          schedule={booking.schedule || []}
          settings={settings}
          status={booking.status}
          totalAmount={booking.total_amount}
          onRefresh={onRefresh}
        />
      </div>
    </article>
  );
}

function ResetDataPanel({
  bookingCount,
  onReset,
}: {
  bookingCount: number;
  onReset: (formData: FormData) => Promise<ResetBookingDataResult>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">(
    "success",
  );
  const canReset = confirmation === "RESET BOOKINGS";

  async function handleReset(formData: FormData) {
    setMessage(null);
    const result = await onReset(formData);

    if (result?.ok) {
      setConfirmation("");
      setMessageTone("success");
      setMessage(`Reset complete. Deleted ${result.deletedCount} bookings.`);
      return;
    }

    setMessageTone("error");
    setMessage(result?.error || "Couldn't reset bookings. Please try again.");
  }

  return (
    <section className="mt-8 rounded-2xl border border-red-300/25 bg-red-400/[0.035] p-4 sm:p-5">
      <div className="max-w-3xl">
        <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-red-200/80">
          Reset data
        </p>
        <h2 className="mt-2 font-display text-xl font-bold text-white">
          Clear all bookings
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Permanently deletes every booking, including history and schedule slots. Courts, pricing, hours, and admin access are kept.
        </p>
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-white/10 bg-black/35 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
            Current bookings
          </p>
          <p className="mt-1 text-2xl font-bold text-white">{bookingCount}</p>
        </div>
        <p className="rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-100">
          This cannot be undone.
        </p>
      </div>

      <form action={handleReset} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-zinc-300">
          Type RESET BOOKINGS to confirm
          <input
            className="h-12 w-full rounded-xl border border-white/10 bg-black px-3 text-white outline-none transition hover:bg-white/[0.04] focus:border-white/35"
            name="confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        {message ? (
          <p
            className={[
              "rounded-xl border px-4 py-3 text-sm font-semibold",
              messageTone === "success"
                ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                : "border-red-400/30 bg-red-400/10 text-red-100",
            ].join(" ")}
          >
            {message}
          </p>
        ) : null}
        <ResetSubmitButton enabled={canReset} />
      </form>
    </section>
  );
}

function ResetSubmitButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || !enabled;

  return (
    <div className="flex justify-end">
      <button
        className={[
          "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border px-5 font-display text-xs font-bold uppercase tracking-[0.12em] transition sm:w-auto",
          disabled
            ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-zinc-400"
            : "cursor-pointer border-red-300/35 bg-red-400/10 text-red-100 hover:border-red-300/60 hover:bg-red-400/20",
        ].join(" ")}
        disabled={disabled}
        type="submit"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Resetting..." : "Reset bookings"}
      </button>
    </div>
  );
}

function ScheduleView({
  adminMutationLockError,
  bookings,
  courts,
  date,
  error,
  isLoading,
  settings,
  onDateChange,
  onImported,
  onOnsiteAdded,
}: {
  adminMutationLockError: string | null;
  bookings: AdminScheduleBooking[];
  courts: CourtOption[];
  date: string;
  error: string | null;
  isLoading: boolean;
  settings: BookingSettings;
  onDateChange: (date: string) => void;
  onImported: (result: BookingImportResponse) => Promise<void>;
  onOnsiteAdded: () => Promise<void>;
}) {
  const hours = useMemo(
    () => getAdminScheduleHours(date, bookings, settings),
    [bookings, date, settings],
  );

  function moveDate(days: number) {
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    onDateChange(next.toISOString().slice(0, 10));
  }

  return (
    <section className="mt-8">
      <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
            Court schedule
          </p>
          <h2 className="mt-2 font-display text-lg font-bold">
            Confirmed bookings by court
          </h2>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button
            aria-label="Previous day"
            className="grid min-h-10 cursor-pointer place-items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-zinc-300 transition hover:border-white/30 hover:bg-white/[0.09] hover:text-white sm:w-11"
            type="button"
            onClick={() => moveDate(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            aria-label="Schedule date"
            className="admin-date-input order-first col-span-2 min-h-10 w-full min-w-0 max-w-full cursor-pointer appearance-none rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition hover:bg-white/[0.04] focus:border-white/35 sm:order-none sm:w-auto"
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
          />
          <button
            aria-label="Next day"
            className="grid min-h-10 cursor-pointer place-items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-zinc-300 transition hover:border-white/30 hover:bg-white/[0.09] hover:text-white sm:w-11"
            type="button"
            onClick={() => moveDate(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <OnsiteBookingForm
        courts={courts}
        date={date}
        lockError={adminMutationLockError}
        settings={settings}
        onAdded={onOnsiteAdded}
      />

      <BookingListImporter
        lockError={adminMutationLockError}
        onImported={onImported}
      />

      {isLoading ? (
        <ScheduleGridSkeleton courts={courts} hours={hours} />
      ) : error ? (
        <div
          className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-8 text-center"
          role="alert"
        >
          <p className="text-sm font-bold text-red-100">
            Couldn&apos;t load the court schedule.
          </p>
          <p className="mt-1 text-xs text-red-200/70">{error}</p>
        </div>
      ) : (
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {courts.map((court) => (
          <div
            className="min-w-0 rounded-2xl border border-white/10 bg-zinc-950 p-3 sm:p-4"
            key={court.id}
          >
            <h3 className="truncate font-display text-base font-bold uppercase tracking-wide sm:text-lg">
              {court.name}
            </h3>
            <div className="mt-4 grid gap-2">
              {hours.map((hour) => {
                const slotStart = manilaHourToUtc(date, hour).getTime();
                const slotBookings = bookings.filter((booking) => {
                  return (
                    booking.courtId === court.id &&
                    new Date(booking.startAt).getTime() <= slotStart &&
                    new Date(booking.endAt).getTime() > slotStart
                  );
                });

                return (
                  <div
                    className={[
                      "grid min-w-0 gap-2 rounded-xl border px-3 py-3 sm:grid-cols-[6.5rem_minmax(0,1fr)]",
                      slotBookings.length === 1
                        ? getSchedulePaymentClasses(slotBookings[0].paymentStatus)
                        : slotBookings.length > 1
                          ? "border-amber-300/30 bg-amber-300/[0.06]"
                        : "border-white/10 bg-black/35",
                    ].join(" ")}
                    key={hour}
                  >
                    <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                      {formatSlotLabel(hour)}
                    </p>
                    {slotBookings.length ? (
                      <div className="grid min-w-0 gap-2">
                        {slotBookings.length > 1 ? (
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-200">
                            {slotBookings.length} overlapping bookings
                          </p>
                        ) : null}
                        {slotBookings.map((slotBooking) => (
                          <div
                            className="min-w-0 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2"
                            key={slotBooking.id}
                          >
                            <p className="whitespace-nowrap text-sm font-bold text-white">
                              {slotBooking.customerName}
                            </p>
                            <p className="mt-1 break-words text-xs text-zinc-400">
                              {slotBooking.customerContact} /{" "}
                              {formatPaymentMethod(slotBooking.paymentMethod)} /{" "}
                              {formatPeso(slotBooking.totalAmount)}
                            </p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-zinc-300">
                              {formatImportedPaymentStatus(
                                slotBooking.paymentStatus,
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-400">Empty slot</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      )}

    </section>
  );
}

function ScheduleGridSkeleton({
  courts,
  hours,
}: {
  courts: CourtOption[];
  hours: number[];
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="mt-5 grid animate-pulse gap-4 lg:grid-cols-2"
      role="status"
    >
      <span className="sr-only">Loading schedule…</span>
      {courts.map((court) => (
        <div
          className="min-w-0 rounded-2xl border border-white/10 bg-zinc-950 p-3 sm:p-4"
          key={court.id}
        >
          <div className="h-6 w-28 rounded bg-white/[0.09]" />
          <div className="mt-4 grid gap-2">
            {hours.map((hour) => (
              <div
                className="grid min-h-[3.75rem] min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-3 sm:grid-cols-[6.5rem_minmax(0,1fr)]"
                key={hour}
              >
                <div className="h-3 w-20 rounded bg-white/[0.09]" />
                <div className="h-3 w-24 rounded bg-white/[0.06]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function getAdminScheduleHours(
  date: string,
  bookings: AdminScheduleBooking[],
  settings: BookingSettings,
) {
  const hours = new Set(
    getCalendarOperatingHours(settings.openHour, settings.closeHour),
  );
  const dayStart = manilaHourToUtc(date, 0).getTime();

  for (const booking of bookings) {
    const startHour = Math.floor(
      (new Date(booking.startAt).getTime() - dayStart) / 3_600_000,
    );
    const endHour = Math.ceil(
      (new Date(booking.endAt).getTime() - dayStart) / 3_600_000,
    );
    for (let hour = startHour; hour < endHour; hour += 1) {
      if (hour >= 0 && hour < 29) hours.add(hour);
    }
  }

  return [...hours].sort((left, right) => left - right);
}

function getSchedulePaymentClasses(
  status: AdminScheduleBooking["paymentStatus"],
) {
  if (status === "PAID") return "border-lime-300/30 bg-lime-300/[0.09]";
  if (status === "HALF_PAID") {
    return "border-amber-300/30 bg-amber-300/[0.09]";
  }
  if (status === "UNPAID") return "border-red-300/30 bg-red-300/[0.09]";
  return "border-white/20 bg-white/[0.06]";
}

function formatImportedPaymentStatus(
  status: AdminScheduleBooking["paymentStatus"],
) {
  if (status === "PAID") return "Fully paid";
  if (status === "HALF_PAID") return "Partially paid";
  if (status === "UNPAID") return "Not paid";
  return "Payment not recorded";
}

async function fetchAdminBookings(url: string) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Couldn't load bookings. Please refresh.");
  }

  return payload as AdminBookingsPayload;
}

async function fetchSchedule(url: string) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Couldn't load the schedule. Please refresh.");
  }

  return payload as SchedulePayload;
}

function buildAdminBookingsKey(filters: AdminBookingFilters) {
  return `/api/admin/bookings?${filtersToQuery(filters, filters.page)}`;
}

function filtersToQuery(filters: AdminBookingFilters, page: number) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  for (const [key, value] of Object.entries(filters)) {
    if (key === "page") continue;
    if (value) params.set(key, String(value));
  }
  return params.toString();
}

function filtersFromSearchParams(
  params: URLSearchParams,
): AdminBookingFilters {
  const status = params.get("status") || "";
  const paymentMethod = params.get("paymentMethod") || "";
  const date = params.get("date") || "";

  return {
    page: Math.max(1, Number(params.get("page") || 1) || 1),
    status: ["PENDING_REVIEW", "ACCEPTED", "CANCELLED", "REJECTED"].includes(
      status,
    )
      ? status
      : "",
    courtId: (params.get("courtId") || "").trim(),
    paymentMethod: ["BPI", "GOTYME", "ONSITE"].includes(paymentMethod)
      ? paymentMethod
      : "",
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
    q: (params.get("q") || "").trim().slice(0, 80),
  };
}

function formatManilaTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function formatCreatedAt(value?: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Not recorded";
  return formatManilaDateTime(value);
}

function getNewBookingLabel(
  booking: AdminBooking,
  currentTime: number | null,
) {
  if (
    booking.status !== "PENDING_REVIEW" ||
    !booking.created_at ||
    currentTime === null
  ) {
    return null;
  }

  const createdAt = new Date(booking.created_at).getTime();
  if (!Number.isFinite(createdAt)) return null;

  const age = Math.max(0, currentTime - createdAt);
  if (age >= NEW_BOOKING_WINDOW_MS) return null;

  const minutes = Math.floor(age / 60_000);
  return minutes < 1 ? "New · just now" : `New · ${minutes} min`;
}

function getReservedConflictIds(bookings: AdminBooking[]) {
  const acceptedBookings = bookings.filter(
    (booking) => booking.status === "ACCEPTED",
  );
  const conflictIds = new Set<string>();

  for (const booking of bookings) {
    if (booking.status !== "PENDING_REVIEW") continue;

    const hasConflict = acceptedBookings.some(
      (acceptedBooking) =>
        (booking.schedule || []).some((pendingSlot) =>
          (acceptedBooking.schedule || []).some(
            (acceptedSlot) =>
              acceptedSlot.courtId === pendingSlot.courtId &&
              new Date(acceptedSlot.startAt).getTime() <
                new Date(pendingSlot.endAt).getTime() &&
              new Date(acceptedSlot.endAt).getTime() >
                new Date(pendingSlot.startAt).getTime(),
          ),
        ),
    );

    if (hasConflict) {
      conflictIds.add(booking.id);
    }
  }

  return conflictIds;
}
