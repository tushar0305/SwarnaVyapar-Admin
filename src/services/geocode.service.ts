'use server';

import {
  reverseGeocode as reverseGeocodeOsm,
  searchPlaces as searchPlacesOsm,
  type NominatimPlace,
} from '@/lib/nominatim';
import { requireSuperAdmin } from './admin-auth.service';

/** Server-side Nominatim (can send User-Agent). No SerpApi credits. */
export async function reverseGeocodeAction(
  lat: number,
  lon: number
): Promise<NominatimPlace> {
  await requireSuperAdmin();
  return reverseGeocodeOsm(lat, lon);
}

export async function searchPlacesAction(
  query: string,
  limit = 5
): Promise<NominatimPlace[]> {
  await requireSuperAdmin();
  return searchPlacesOsm(query, limit);
}
