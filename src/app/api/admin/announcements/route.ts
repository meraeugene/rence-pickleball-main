import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminMutationLockError } from "@/utils/admin/getAdminMutationLockError";
import { requireAdmin } from "@/utils/admin/requireAdmin";
import {
  ANNOUNCEMENTS_CACHE_TAG,
  isMissingAnnouncementsTable,
} from "@/utils/announcements/getAnnouncements";
import {
  deleteAnnouncementImage,
  uploadAnnouncementImageFile,
} from "@/utils/cloudinary/announcementImageStorage";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

// Vercel rejects request bodies over ~4.5MB, so stay under that.
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

const announcementSchema = z.object({
  title: z.string().trim().min(1, "Add a title.").max(120, "Keep the title under 120 characters."),
  body: z.string().trim().max(1000, "Keep the message under 1000 characters."),
  published: z.boolean(),
});

// Multipart upload (image + text), so this is a route instead of a server action.
export async function POST(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser?.email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const lockError = getAdminMutationLockError();
  if (lockError) return NextResponse.json({ error: lockError }, { status: 503 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form." }, { status: 400 });

  const parsed = announcementSchema.safeParse({
    title: String(formData.get("title") || ""),
    body: String(formData.get("body") || ""),
    published: formData.get("published") !== "false",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Check the announcement details." },
      { status: 400 },
    );
  }

  const file = formData.get("image");
  const hasImage = file instanceof File && file.size > 0;
  if (hasImage) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "The picture must be an image file." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "The picture must be 4MB or smaller." }, { status: 400 });
    }
  }

  let upload: { secureUrl: string; publicId: string } | null = null;
  if (hasImage) {
    try {
      upload = await uploadAnnouncementImageFile(file);
    } catch {
      return NextResponse.json({ error: "Unable to upload the picture. Please try again." }, { status: 502 });
    }
  }

  const { error } = await createAdminClient().from("announcements").insert({
    title: parsed.data.title,
    body: parsed.data.body || null,
    image_url: upload?.secureUrl ?? null,
    image_public_id: upload?.publicId ?? null,
    published: parsed.data.published,
    created_by_email: adminUser.email.toLowerCase(),
  });

  if (error) {
    if (upload) await deleteAnnouncementImage(upload.publicId).catch(() => undefined);
    return NextResponse.json(
      {
        error: isMissingAnnouncementsTable(error)
          ? "Announcements are not installed yet. Run the announcements SQL in Supabase."
          : "Unable to save the announcement. Please try again.",
      },
      { status: 500 },
    );
  }

  revalidateTag(ANNOUNCEMENTS_CACHE_TAG, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/admin");
  return NextResponse.json({
    ok: true,
    message: parsed.data.published ? "Announcement posted." : "Announcement saved as hidden.",
  });
}
