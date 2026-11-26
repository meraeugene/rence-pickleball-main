// Set only verified UNO RALLY venue details.
export const brandConfig = {
  name: "UNO RALLY",
  address: process.env.NEXT_PUBLIC_VENUE_ADDRESS || "",
  phone: process.env.NEXT_PUBLIC_VENUE_PHONE || "",
  mapsUrl: process.env.NEXT_PUBLIC_VENUE_MAPS_URL || "https://maps.app.goo.gl/a9mEg5kCnyCL2uN88",
  mapsEmbedUrl: "https://maps.google.com/maps?q=8.477137,124.624064&z=17&output=embed",
  socialUrl: process.env.NEXT_PUBLIC_VENUE_SOCIAL_URL || "https://www.facebook.com/unorally",
};
