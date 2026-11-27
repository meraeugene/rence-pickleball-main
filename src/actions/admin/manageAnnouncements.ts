"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import type { AnnouncementMutationResult } from "@/types/announcement";
import { getAdminMutationLockError } from "@/utils/admin/getAdminMutationLockError";
import { requireAdmin } from "@/utils/admin/requireAdmin";
import { ANNOUNCEMENTS_CACHE_TAG } from "@/utils/announcements/getAnnouncements";
import { deleteAnnouncementImage } from "@/utils/cloudinary/announcementImageStorage";
import { createAdminClient } from "@/utils/supabase/admin";

const idSchema = z.uuid();

async function authorize(): Promise<{ ok: true } | { ok: false; error: string }> {
  const adminUser = await requireAdmin();
  if (!adminUser?.email) return { ok: false, error: "Unauthorized." };
  const lockError = getAdminMutationLockError();
  if (lockError) return { ok: false, error: lockError };
  return { ok: true };
}

function done(message: string): AnnouncementMutationResult {
  updateTag(ANNOUNCEMENTS_CACHE_TAG);
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true, message };
}

export async function setAnnouncementPublished(
  id: string,
  published: boolean,
): Promise<AnnouncementMutationResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Announcement not found." };

  const { error } = await createAdminClient()
    .from("announcements")
    .update({ published: Boolean(published) })
    .eq("id", id);
  if (error) return { ok: false, error: "Unable to update the announcement." };

  return done(published ? "Announcement is now showing on the site." : "Announcement hidden from the site.");
}

export async function deleteAnnouncement(id: string): Promise<AnnouncementMutationResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Announcement not found." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .delete()
    .eq("id", id)
    .select("image_public_id")
    .maybeSingle();
  if (error) return { ok: false, error: "Unable to delete the announcement." };

  if (data?.image_public_id) {
    await deleteAnnouncementImage(data.image_public_id).catch(() => undefined);
  }

  return done("Announcement deleted.");
}
