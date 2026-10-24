export function externalNavigationUrl(input: {
  latitude?: number | null;
  longitude?: number | null;
  address: string;
}): string {
  const hasPoint = typeof input.latitude === "number" && typeof input.longitude === "number";
  const destination = hasPoint ? `${input.latitude},${input.longitude}` : input.address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}
