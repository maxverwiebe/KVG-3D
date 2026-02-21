import type { LiveStop, LiveVehicle } from "@/lib/kvg";

import { MAX_SEARCH_RESULTS } from "@/components/live-bus-viewer/constants";
import type { SearchResult } from "@/components/live-bus-viewer/types";

export function buildSearchableStops(stops: LiveStop[], selectedTripStops: LiveStop[]): LiveStop[] {
  const dedupe = new Map<string, LiveStop>();

  for (const stop of stops) {
    dedupe.set(stop.id, stop);
  }

  for (const stop of selectedTripStops) {
    dedupe.set(stop.id, stop);
  }

  return [...dedupe.values()];
}

export function buildSearchResults(
  queryInput: string,
  vehicles: LiveVehicle[],
  searchableStops: LiveStop[]
): SearchResult[] {
  const query = queryInput.trim().toLowerCase();
  if (!query) {
    return [];
  }

  const vehicleResults: SearchResult[] = vehicles
    .filter((vehicle) => {
      const haystack = `${vehicle.name} ${vehicle.id} ${vehicle.tripId}`.toLowerCase();
      return haystack.includes(query);
    })
    .map((vehicle) => ({
      kind: "vehicle",
      key: `vehicle-${vehicle.id}`,
      title: vehicle.name || vehicle.id,
      subtitle: `${vehicle.id} · ${vehicle.tripId}`,
      vehicle
    }));

  const stopResults: SearchResult[] = searchableStops
    .filter((stop) => {
      const haystack = `${stop.name} ${stop.shortName} ${stop.id}`.toLowerCase();
      return haystack.includes(query);
    })
    .map((stop) => ({
      kind: "stop",
      key: `stop-${stop.id}`,
      title: stop.name,
      subtitle: `${stop.shortName} · ${stop.id}`,
      stop
    }));

  if (!vehicleResults.length || !stopResults.length) {
    return [...vehicleResults, ...stopResults].slice(0, MAX_SEARCH_RESULTS);
  }

  const halfLimit = Math.max(1, Math.floor(MAX_SEARCH_RESULTS / 2));
  const selectedVehicleResults = vehicleResults.slice(0, halfLimit);
  const selectedStopResults = stopResults.slice(0, halfLimit);
  const selectedResults: SearchResult[] = [...selectedVehicleResults, ...selectedStopResults];

  const remainingVehicleResults = vehicleResults.slice(selectedVehicleResults.length);
  const remainingStopResults = stopResults.slice(selectedStopResults.length);

  return [...selectedResults, ...remainingVehicleResults, ...remainingStopResults].slice(0, MAX_SEARCH_RESULTS);
}
