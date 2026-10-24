export function mapTiles(): { url: string; attribution: string } | null {
  const url = process.env.NEXT_PUBLIC_MAP_TILE_URL;
  const attribution = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION;
  if (url && attribution) return { url, attribution };
  if (process.env.NODE_ENV === "development") {
    return {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    };
  }
  return null;
}
