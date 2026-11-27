"use client";

/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { Eye, EyeOff, ImagePlus, Loader2, Megaphone, Trash2, X } from "lucide-react";
import { deleteAnnouncement, setAnnouncementPublished } from "@/actions/admin/manageAnnouncements";
import type { Announcement } from "@/types/announcement";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-white/40 sm:text-sm";

export function AnnouncementsManager({
  items,
  lockError,
  missingTable,
}: {
  items: Announcement[];
  lockError: string | null;
  missingTable: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const disabled = Boolean(lockError) || missingTable;

  // Free the preview's memory when the page unmounts.
  const previewRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  function showPreview(next: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next ? URL.createObjectURL(next) : null;
    setPreviewUrl(previewRef.current);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] || null;
    setError(null);
    if (next && !next.type.startsWith("image/")) {
      setError("Choose an image file (JPG, PNG or WebP).");
      event.target.value = "";
      return;
    }
    if (next && next.size > MAX_IMAGE_SIZE) {
      setError("The picture must be 4MB or smaller.");
      event.target.value = "";
      return;
    }
    setFile(next);
    showPreview(next);
  }

  function clearFile() {
    setFile(null);
    showPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || submitting) return;
    setError(null);
    setNotice(null);
    if (!title.trim()) {
      setError("Add a title.");
      return;
    }
    if (!file && !body.trim()) {
      setError("Add a picture or a message.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("body", body);
    formData.append("published", String(published));
    if (file) formData.append("image", file);

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/announcements", { method: "POST", body: formData });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || "Unable to save the announcement.");
        return;
      }
      setTitle("");
      setBody("");
      setPublished(true);
      clearFile();
      setNotice(payload?.message || "Announcement posted.");
      router.refresh();
    } catch {
      setError("Unable to connect. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function run(id: string, action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    setNotice(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await action();
      setPendingId(null);
      setConfirmDeleteId(null);
      if (!result.ok) {
        setError(result.error || "Something went wrong.");
        return;
      }
      setNotice(result.message || "Saved.");
      router.refresh();
    });
  }

  return (
    <section className="mt-8 grid gap-6">
      <div>
        <h2 className="font-display text-xl font-black uppercase tracking-[0.08em] text-white">Announcements</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Post events, promos and notices. They show in the Announcements section of the homepage.
        </p>
      </div>

      {missingTable ? (
        <p className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100" role="alert">
          Announcements aren&apos;t set up in the database yet. Run{" "}
          <code className="font-mono text-xs">supabase/migrations/20261127000000_add_announcements.sql</code>{" "}
          in the Supabase SQL editor, then reload this page.
        </p>
      ) : null}
      {lockError ? (
        <p className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100" role="alert">
          {lockError}
        </p>
      ) : null}

      <form className="grid gap-4 rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:p-5" onSubmit={submit} noValidate>
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-zinc-400" />
          <h3 className="font-display text-sm font-bold text-white">New announcement</h3>
        </div>

        <label className="grid gap-2 text-xs font-bold text-zinc-300">
          Title
          <input
            className={inputClass}
            disabled={disabled || submitting}
            maxLength={120}
            placeholder="e.g. Holiday Open Play – Dec 20"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="grid gap-2 text-xs font-bold text-zinc-300">
          Message <span className="font-normal text-zinc-500">(optional if you add a picture)</span>
          <textarea
            className={`${inputClass} min-h-28 resize-y`}
            disabled={disabled || submitting}
            maxLength={1000}
            placeholder="Details, time, how to join…"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <span className="text-right font-normal text-zinc-600">{body.length}/1000</span>
        </label>

        <div className="grid gap-2 text-xs font-bold text-zinc-300">
          Picture / poster <span className="font-normal text-zinc-500">(optional, up to 4MB)</span>
          {previewUrl ? (
            <div className="relative w-full max-w-xs overflow-hidden rounded-xl border border-white/10 bg-black">
              <img alt="Selected announcement picture" className="h-auto w-full" src={previewUrl} />
              <button
                aria-label="Remove picture"
                className="absolute right-2 top-2 grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-black/70 text-white hover:bg-black"
                disabled={submitting}
                type="button"
                onClick={clearFile}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              className="flex min-h-24 w-full max-w-xs cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-zinc-400 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || submitting}
              type="button"
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus className="h-5 w-5" />
              <span className="text-xs font-semibold">Choose a picture</span>
            </button>
          )}
          <input ref={fileInput} accept="image/*" className="hidden" type="file" onChange={chooseFile} />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-3">
          <input
            checked={published}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-lime-300"
            disabled={disabled || submitting}
            type="checkbox"
            onChange={(event) => setPublished(event.target.checked)}
          />
          <span className="text-xs leading-5 text-zinc-400">
            <span className="block font-bold text-zinc-200">Show on the website now</span>
            Untick to save it hidden and publish later.
          </span>
        </label>

        {error ? (
          <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100" role="status">
            {notice}
          </p>
        ) : null}

        <div className="flex justify-end">
          <button
            className="premium-button min-h-11 cursor-pointer rounded-lg px-5 font-display text-xs font-bold uppercase tracking-[0.14em] disabled:cursor-wait disabled:opacity-60"
            disabled={disabled || submitting}
            type="submit"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
            {submitting ? "Posting…" : published ? "Post announcement" : "Save hidden"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        <div className="border-b border-white/10 px-4 py-4">
          <h3 className="font-display text-sm font-bold text-white">Posted announcements</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {items.filter((item) => item.published).length} showing · {items.filter((item) => !item.published).length} hidden
          </p>
        </div>
        {items.length ? (
          <ul className="divide-y divide-white/10">
            {items.map((item) => (
              <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start" key={item.id}>
                {item.imageUrl ? (
                  <img alt="" className="h-20 w-20 shrink-0 rounded-lg border border-white/10 object-cover" src={item.imageUrl} />
                ) : (
                  <span className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-500">
                    <Megaphone className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-white">{item.title}</p>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider",
                        item.published ? "bg-emerald-300/15 text-emerald-200" : "bg-white/10 text-zinc-400",
                      ].join(" ")}
                    >
                      {item.published ? "Showing" : "Hidden"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{formatPostedDate(item.createdAt)}</p>
                  {item.body ? <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-zinc-400">{item.body}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  {confirmDeleteId === item.id ? (
                    <>
                      <button
                        className="min-h-9 cursor-pointer rounded-lg border border-white/10 px-3 text-xs font-semibold text-zinc-300 hover:border-white/30"
                        disabled={pendingId === item.id}
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Keep
                      </button>
                      <button
                        className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/10 px-3 text-xs font-semibold text-red-100 hover:bg-red-400/20"
                        disabled={pendingId === item.id}
                        type="button"
                        onClick={() => run(item.id, () => deleteAnnouncement(item.id))}
                      >
                        {pendingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Delete for good
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-zinc-200 hover:border-white/30 disabled:opacity-50"
                        disabled={disabled || pendingId === item.id}
                        type="button"
                        onClick={() => run(item.id, () => setAnnouncementPublished(item.id, !item.published))}
                      >
                        {pendingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : item.published ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        {item.published ? "Hide" : "Show"}
                      </button>
                      <button
                        aria-label={`Delete ${item.title}`}
                        className="grid min-h-9 w-9 cursor-pointer place-items-center rounded-lg border border-white/10 text-zinc-400 hover:border-red-400/40 hover:text-red-200 disabled:opacity-50"
                        disabled={disabled || pendingId === item.id}
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">No announcements yet.</p>
        )}
      </div>
    </section>
  );
}

function formatPostedDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
