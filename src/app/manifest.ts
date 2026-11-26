import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UNO RALLY Pickleball", short_name: "UNO RALLY",
    description: "Your court. Your crew. Your rally. Pickleball court booking.",
    start_url: "/", scope: "/", display: "standalone",
    background_color: "#000000", theme_color: "#000000",
    icons: [
      { src: "/uno-rally-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
