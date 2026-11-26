"use client";

import { ArrowRight, Loader2, UserRound, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { AccessChoiceAction } from "@/types/auth";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { GoogleIcon } from "./GoogleIcon";

export function AccessChoiceModal({
  error, open, pendingAction, title, onClose, onGuest, onGoogle,
}: {
  error?: string | null;
  open: boolean;
  pendingAction: AccessChoiceAction;
  title: string;
  onClose: () => void;
  onGuest: () => void;
  onGoogle: () => void;
}) {
  const dialogRef = useDialogFocus(open, () => { if (pendingAction === null) onClose(); });
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] grid min-h-dvh place-items-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm">
      <div ref={dialogRef} role="dialog" aria-labelledby="access-choice-title" aria-modal="true" tabIndex={-1} className="modern-access-dialog silver-border glass-panel relative grid w-full max-w-3xl overflow-hidden rounded-[1.5rem] text-white md:grid-cols-2">
        <div className="border-b border-white/10 bg-white/[0.025] p-6 md:border-b-0 md:border-r md:p-9">
          <BrandLogo className="w-28" />
          <p className="mt-8 text-[0.6rem] uppercase tracking-[0.2em] text-zinc-500">UNO RALLY / Your next game</p>
          <p className="font-display hero-shine-text mt-4 text-2xl font-black uppercase leading-snug">A place on<br />the court.</p>
          <p className="mt-5 max-w-xs text-xs leading-7 text-zinc-400">Book as a guest, or sign in with Google to save your bookings.</p>
        </div>
        <div className="p-6 md:p-9">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-lg font-black uppercase" id="access-choice-title">{title}</h3>
            <button aria-label="Close login options" className="menu-icon-button" disabled={pendingAction !== null} type="button" onClick={onClose}><X size={18} /></button>
          </div>
          {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs leading-6 text-red-200">{error}</p>}
          <button className="premium-button mt-8 h-12 w-full rounded-xl px-4 text-xs font-bold" disabled={pendingAction !== null} type="button" onClick={onGuest}>{pendingAction === "guest" ? <Loader2 size={16} className="animate-spin" /> : <UserRound size={16} />} Continue as guest <ArrowRight size={14} /></button>
          <div className="my-5 flex items-center gap-3 text-[0.6rem] uppercase tracking-widest text-zinc-600"><span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" /></div>
          <button className="premium-button-dark h-12 w-full rounded-xl px-4 text-xs font-semibold" disabled={pendingAction !== null} type="button" onClick={onGoogle}>{pendingAction === "google" ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />} Continue with Google</button>
          <p className="mt-6 text-[0.65rem] leading-6 text-zinc-500">Guest bookings are saved on this device only.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
