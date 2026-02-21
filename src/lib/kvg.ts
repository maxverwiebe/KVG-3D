export const COORDINATE_FACTOR = 3_600_000;
export const ID_PREFIX = "kvg-";

export const KIEL_CENTER = {
  latitude: 54.3233,
  longitude: 10.1399
};

const METERS_PER_DEGREE_LAT = 111_320;

export type KvgVehicleRaw = {
  id: string;
  name: string;
  heading: number;
  latitude: number;
  longitude: number;
  tripId: string;
  isDeleted: boolean;
};

export type KvgStopRaw = {
  id: string;
  shortName: string;
  name: string;
  latitude: number;
  longitude: number;
  alerts: string[];
};

export type LiveVehicle = {
  id: string;
  name: string;
  heading: number;
  tripId: string;
  latitude: number;
  longitude: number;
};

export type LiveStop = {
  id: string;
  shortName: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type SnapshotPayload = {
  vehicles: LiveVehicle[];
  stops: LiveStop[];
  updatedAt: string;
};

export type TripPathPayload = {
  tripId: string;
  path: [number, number][];
};

export type TripStopsPayload = {
  tripId: string;
  stops: LiveStop[];
};

export type KvgTripPathWaypointRaw = {
  lat: number;
  lon: number;
};

export type KvgTripPathRaw = {
  wayPoints?: KvgTripPathWaypointRaw[];
};

export type KvgTripPathResponseRaw = {
  paths?: KvgTripPathRaw[];
};

export type KvgTripStopStopRaw = {
  shortName?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
};

export type KvgTripStopRaw = {
  stop?: KvgTripStopStopRaw;
};

export type KvgTripStopsResponseRaw = {
  actual?: KvgTripStopRaw[];
  old?: KvgTripStopRaw[];
};

export function decodeCoordinate(rawCoordinate: number): number {
  return rawCoordinate / COORDINATE_FACTOR;
}

export function toLiveVehicle(vehicle: KvgVehicleRaw): LiveVehicle {
  return {
    id: `${ID_PREFIX}${vehicle.id}`,
    name: vehicle.name,
    heading: vehicle.heading,
    tripId: `${ID_PREFIX}${vehicle.tripId}`,
    latitude: decodeCoordinate(vehicle.latitude),
    longitude: decodeCoordinate(vehicle.longitude)
  };
}

export function toLiveStop(stop: KvgStopRaw): LiveStop {
  return {
    id: `${ID_PREFIX}${stop.shortName}`,
    shortName: stop.shortName,
    name: stop.name,
    latitude: decodeCoordinate(stop.latitude),
    longitude: decodeCoordinate(stop.longitude)
  };
}

export function stripIdPrefix(id: string): string {
  if (id.startsWith(ID_PREFIX)) {
    return id.slice(ID_PREFIX.length);
  }

  return id;
}

export function latLonToScene(
  latitude: number,
  longitude: number,
  center: { latitude: number; longitude: number } = KIEL_CENTER
): [number, number, number] {
  const latitudeDelta = latitude - center.latitude;
  const longitudeDelta = longitude - center.longitude;
  const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos((center.latitude * Math.PI) / 180);

  const x = longitudeDelta * metersPerDegreeLon;
  const z = latitudeDelta * METERS_PER_DEGREE_LAT;

  return [x, 0, z];
}
