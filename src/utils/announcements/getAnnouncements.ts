import { unstable_cache } from "next/cache";
import type { Announcement } from "@/types/announcement";
import { createAdminClient } from "@/utils/supabase/admin";

export const ANNOUNCEMENTS_CACHE_TAG = "announcements";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  published: boolean;
  created_at: string;
};

type DatabaseError = { code?: string; message?: string } | null | undefined;

/** True when the announcements migration has not been run in Supabase yet. */
export function isMissingAnnouncementsTable(error: DatabaseError) {
  if (!error) return false;
  const message = (error.message || "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("announcements") &&
      (message.includes("does not exist") || message.includes("could not find")))
  );
}

function mapAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url,
    published: row.published,
    createdAt: row.created_at,
  };
}

const COLUMNS = "id,title,body,image_url,published,created_at";

async function loadPublishedAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await createAdminClient()
    .from("announcements")
    .select(COLUMNS)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    if (!isMissingAnnouncementsTable(error)) {
      console.error("Unable to load announcements", { code: error.code });
    }
    return [];
  }
  return (data || []).map(mapAnnouncement);
}

/** Homepage list. Cached; admin changes clear it via the announcements tag. */
export const getPublishedAnnouncements = unstable_cache(
  loadPublishedAnnouncements,
  ["published-announcements"],
  { revalidate: 300, tags: [ANNOUNCEMENTS_CACHE_TAG] },
);

/** Admin list: every announcement, including hidden ones. */
export async function getAllAnnouncements(): Promise<{
  items: Announcement[];
  missingTable: boolean;
}> {
  const { data, error } = await createAdminClient()
    .from("announcements")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return { items: [], missingTable: isMissingAnnouncementsTable(error) };
  }
  return { items: (data || []).map(mapAnnouncement), missingTable: false };
}
