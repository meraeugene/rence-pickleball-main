import { requireEnv } from "@/utils/env/appEnv";
import {
  getPaymentProofFolder,
  normalizeFolder,
  signCloudinaryParams,
} from "@/utils/cloudinary/paymentProofStorage";

const DEFAULT_ANNOUNCEMENT_FOLDER = "unorally/announcements";

// Kept outside the payment-proof folder on purpose: the payment-proof cleanup
// cron deletes everything under that folder.
export function getAnnouncementFolder() {
  const folder = normalizeFolder(
    process.env.CLOUDINARY_ANNOUNCEMENT_FOLDER || DEFAULT_ANNOUNCEMENT_FOLDER,
  );
  const paymentFolder = getPaymentProofFolder();
  if (!folder || folder === paymentFolder || folder.startsWith(`${paymentFolder}/`)) {
    throw new Error("Announcement images must not share the payment-proof folder.");
  }
  return folder;
}

function isAnnouncementPublicId(publicId: string) {
  return publicId.startsWith(`${getAnnouncementFolder()}/`);
}

export async function uploadAnnouncementImageFile(file: File) {
  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requireEnv("CLOUDINARY_API_KEY");
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET");
  const folder = getAnnouncementFolder();
  const timestamp = Math.round(Date.now() / 1000).toString();
  const signature = signCloudinaryParams({ folder, timestamp }, apiSecret);

  const uploadData = new FormData();
  uploadData.append("file", file);
  uploadData.append("api_key", apiKey);
  uploadData.append("folder", folder);
  uploadData.append("timestamp", timestamp);
  uploadData.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: uploadData },
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.secure_url || !payload?.public_id) {
    throw new Error("Unable to upload announcement image.");
  }

  return {
    secureUrl: String(payload.secure_url),
    publicId: String(payload.public_id),
  };
}

export async function deleteAnnouncementImage(publicId: string) {
  if (!isAnnouncementPublicId(publicId)) return;

  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requireEnv("CLOUDINARY_API_KEY");
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET");
  const timestamp = Math.round(Date.now() / 1000).toString();
  const signature = signCloudinaryParams({ public_id: publicId, timestamp }, apiSecret);

  const body = new FormData();
  body.append("api_key", apiKey);
  body.append("public_id", publicId);
  body.append("timestamp", timestamp);
  body.append("signature", signature);

  await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body,
  });
}
