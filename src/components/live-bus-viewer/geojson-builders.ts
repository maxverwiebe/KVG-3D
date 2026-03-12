import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";

import type { LiveStop, LiveVehicle } from "@/lib/kvg";

import { MAX_STOPS_IN_MAP } from "@/components/live-bus-viewer/constants";
import type {
  StopProperties,
  TrackProperties,
  VehicleDirectionProperties,
  VehicleLabelProperties,
  VehicleProperties
} from "@/components/live-bus-viewer/types";

const METERS_PER_DEGREE_LAT = 111_320;

export const EMPTY_VEHICLES: FeatureCollection<Polygon, VehicleProperties> = {
  type: "FeatureCollection",
  features: []
};

export const EMPTY_STOPS: FeatureCollection<Point, StopProperties> = {
  type: "FeatureCollection",
  features: []
};

export const EMPTY_VEHICLE_LABELS: FeatureCollection<Point, VehicleLabelProperties> = {
  type: "FeatureCollection",
  features: []
};

export const EMPTY_TRACK: FeatureCollection<LineString, TrackProperties> = {
  type: "FeatureCollection",
  features: []
};

export const EMPTY_VEHICLE_DIRECTION: FeatureCollection<LineString, VehicleDirectionProperties> = {
  type: "FeatureCollection",
  features: []
};

function metersToLngLatOffset(latitude: number, eastMeters: number, northMeters: number): [number, number] {
  const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180);
  return [eastMeters / metersPerDegreeLon, northMeters / METERS_PER_DEGREE_LAT];
}

function toVehicleFeature(vehicle: LiveVehicle, selectedVehicleId: string | null): Feature<Polygon, VehicleProperties> {
  const theta = (vehicle.heading * Math.PI) / 180;
  const halfWidthMeters = 2.4;
  const halfLengthMeters = 6;

  const localCorners: [number, number][] = [
    [-halfWidthMeters, -halfLengthMeters],
    [halfWidthMeters, -halfLengthMeters],
    [halfWidthMeters, halfLengthMeters],
    [-halfWidthMeters, halfLengthMeters],
    [-halfWidthMeters, -halfLengthMeters]
  ];

  const corners = localCorners.map(([eastLocal, northLocal]) => {
    const east = eastLocal * Math.cos(theta) + northLocal * Math.sin(theta);
    const north = -eastLocal * Math.sin(theta) + northLocal * Math.cos(theta);
    const [lngOffset, latOffset] = metersToLngLatOffset(vehicle.latitude, east, north);

    return [vehicle.longitude + lngOffset, vehicle.latitude + latOffset] as [number, number];
  });

  return {
    type: "Feature",
    id: vehicle.id,
    properties: {
      id: vehicle.id,
      name: vehicle.name,
      tripId: vehicle.tripId,
      heading: vehicle.heading,
      lat: vehicle.latitude,
      lon: vehicle.longitude,
      selected: vehicle.id === selectedVehicleId ? 1 : 0
    },
    geometry: {
      type: "Polygon",
      coordinates: [corners]
    }
  };
}

function toStopFeature(stop: LiveStop, isTripStop: boolean): Feature<Point, StopProperties> {
  return {
    type: "Feature",
    id: stop.id,
    properties: {
      id: stop.id,
      shortName: stop.shortName,
      name: stop.name,
      isTripStop: isTripStop ? 1 : 0
    },
    geometry: {
      type: "Point",
      coordinates: [stop.longitude, stop.latitude]
    }
  };
}

export function buildVehicleCollection(
  vehicles: LiveVehicle[],
  selectedVehicleId: string | null
): FeatureCollection<Polygon, VehicleProperties> {
  return {
    type: "FeatureCollection",
    features: vehicles.map((vehicle) => toVehicleFeature(vehicle, selectedVehicleId))
  };
}

export function buildStopCollection(
  stops: LiveStop[],
  selectedTripStops: LiveStop[]
): FeatureCollection<Point, StopProperties> {
  const tripStopMap = new Map<string, LiveStop>(selectedTripStops.map((stop) => [stop.id, stop]));

  const visibleStops = stops.slice(0, MAX_STOPS_IN_MAP);
  const visibleStopIds = new Set(visibleStops.map((stop) => stop.id));

  const merged = [...visibleStops];
  for (const tripStop of selectedTripStops) {
    if (!visibleStopIds.has(tripStop.id)) {
      merged.push(tripStop);
    }
  }

  return {
    type: "FeatureCollection",
    features: merged
      .filter(
        (stop) =>
          Number.isFinite(stop.latitude) &&
          Number.isFinite(stop.longitude) &&
          stop.latitude !== 0 &&
          stop.longitude !== 0
      )
      .map((stop) => toStopFeature(stop, tripStopMap.has(stop.id)))
  };
}

export function buildVehicleLabelCollection(
  vehicles: LiveVehicle[],
  selectedVehicleId: string | null
): FeatureCollection<Point, VehicleLabelProperties> {
  return {
    type: "FeatureCollection",
    features: vehicles.map((vehicle) => ({
      type: "Feature",
      id: vehicle.id,
      properties: {
        id: vehicle.id,
        name: vehicle.name || vehicle.id,
        selected: vehicle.id === selectedVehicleId ? 1 : 0
      },
      geometry: {
        type: "Point",
        coordinates: [vehicle.longitude, vehicle.latitude]
      }
    }))
  };
}

export function buildVehicleDirectionCollection(
  selectedVehicle: LiveVehicle | null
): FeatureCollection<LineString, VehicleDirectionProperties> {
  if (!selectedVehicle) {
    return EMPTY_VEHICLE_DIRECTION;
  }

  const directionLengthMeters = 62;
  const headingRad = (selectedVehicle.heading * Math.PI) / 180;
  const northMeters = directionLengthMeters * Math.cos(headingRad);
  const eastMeters = directionLengthMeters * Math.sin(headingRad);
  const [lngOffset, latOffset] = metersToLngLatOffset(selectedVehicle.latitude, eastMeters, northMeters);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: selectedVehicle.id,
        properties: {
          id: selectedVehicle.id
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [selectedVehicle.longitude, selectedVehicle.latitude],
            [selectedVehicle.longitude + lngOffset, selectedVehicle.latitude + latOffset]
          ]
        }
      }
    ]
  };
}

export function buildTrackCollection(
  tripId: string | null,
  path: [number, number][]
): FeatureCollection<LineString, TrackProperties> {
  if (!tripId || path.length < 2) {
    return EMPTY_TRACK;
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: tripId,
        properties: {
          tripId
        },
        geometry: {
          type: "LineString",
          coordinates: path
        }
      }
    ]
  };
}
