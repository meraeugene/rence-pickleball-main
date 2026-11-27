export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  published: boolean;
  createdAt: string;
};

export type AnnouncementMutationResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };
