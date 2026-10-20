export const PILOT_AREA = { label: 'Puducherry centre', latitude: 11.93, longitude: 79.83 };
export const CATEGORIES = [
  { value: 'errands', label: 'Errands' }, { value: 'tools', label: 'Tools' },
  { value: 'tech', label: 'Tech help' }, { value: 'other', label: 'Other' },
] as const;
export type Category = typeof CATEGORIES[number]['value'];
export type Area = { label: string; latitude: number; longitude: number };
export function coarsePoint(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Invalid coordinates');
  return { latitude: Number(latitude.toFixed(2)), longitude: Number(longitude.toFixed(2)) };
}
export function withinPilot(area: Area) {
  const rad = (n: number) => n * Math.PI / 180;
  const a = Math.sin(rad(area.latitude - PILOT_AREA.latitude) / 2) ** 2 + Math.cos(rad(area.latitude)) * Math.cos(rad(PILOT_AREA.latitude)) * Math.sin(rad(area.longitude - PILOT_AREA.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= 25;
}
export type HelpRequest = {
 id: string; owner_id: string; title: string; description: string; category: Category;
 area_label: string; status: 'open' | 'accepted' | 'completed' | 'cancelled' | 'expired'; accepted_helper_id?: string | null; accepted_offer_id?: string | null; completed_at?: string | null; expires_at: string; created_at: string;
 latitude?: number; longitude?: number; distance_km?: number;
};
