import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";

import type { LiveFlight } from "@/lib/flights";
import type { LiveStop, LiveVehicle } from "@/lib/kvg";

import { MAX_STOPS_IN_MAP } from "@/components/live-bus-viewer/constants";
import type {
  FlightProperties,
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

export const EMPTY_FLIGHTS: FeatureCollection<Polygon, FlightProperties> = {
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

const FLIGHT_BODY_HEIGHT_METERS = 90;
const FLIGHT_ALTITUDE_VISUAL_MIN_METERS = 180;
const FLIGHT_ALTITUDE_VISUAL_MAX_METERS = 4_800;
const FLIGHT_ALTITUDE_VISUAL_SCALE = 0.16;

function toFlightVisualBaseMeters(altitudeMeters: number | null): number {
  const rawAltitude = altitudeMeters ?? 0;
  const scaledAltitude = rawAltitude * FLIGHT_ALTITUDE_VISUAL_SCALE + FLIGHT_ALTITUDE_VISUAL_MIN_METERS;
  return Math.max(
    FLIGHT_ALTITUDE_VISUAL_MIN_METERS,
    Math.min(FLIGHT_ALTITUDE_VISUAL_MAX_METERS, scaledAltitude)
  );
}

function toFlightFeature(flight: LiveFlight): Feature<Polygon, FlightProperties> {
  const theta = (flight.heading * Math.PI) / 180;
  // Top-down silhouette for a simple aircraft shape (nose, wings, tailplane)
  const localShape: [number, number][] = [
    [0, 20],
    [2.2, 11.5],
    [4.4, 8.4],
    [16.2, 5.2],
    [15.2, 2.1],
    [4.8, 3.1],
    [2.2, -6.6],
    [6.8, -10.2],
    [5.8, -12.6],
    [1.8, -10.6],
    [0.9, -18.1],
    [0, -20],
    [-0.9, -18.1],
    [-1.8, -10.6],
    [-5.8, -12.6],
    [-6.8, -10.2],
    [-2.2, -6.6],
    [-4.8, 3.1],
    [-15.2, 2.1],
    [-16.2, 5.2],
    [-4.4, 8.4],
    [-2.2, 11.5],
    [0, 20]
  ];

  const corners = localShape.map(([eastLocal, northLocal]) => {
    const east = eastLocal * Math.cos(theta) + northLocal * Math.sin(theta);
    const north = -eastLocal * Math.sin(theta) + northLocal * Math.cos(theta);
    const [lngOffset, latOffset] = metersToLngLatOffset(flight.latitude, east, north);

    return [flight.longitude + lngOffset, flight.latitude + latOffset] as [number, number];
  });

  const renderBaseMeters = toFlightVisualBaseMeters(flight.altitudeMeters);

  return {
    type: "Feature",
    id: flight.id,
    properties: {
      id: flight.id,
      callsign: flight.callsign,
      heading: flight.heading,
      altitudeMeters: flight.altitudeMeters,
      renderBaseMeters,
      renderTopMeters: renderBaseMeters + FLIGHT_BODY_HEIGHT_METERS
    },
    geometry: {
      type: "Polygon",
      coordinates: [corners]
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

export function buildFlightCollection(flights: LiveFlight[]): FeatureCollection<Polygon, FlightProperties> {
  return {
    type: "FeatureCollection",
    features: flights
      .filter(
        (flight) =>
          Number.isFinite(flight.latitude) &&
          Number.isFinite(flight.longitude) &&
          flight.latitude !== 0 &&
          flight.longitude !== 0
      )
      .map(toFlightFeature)
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
