export type LiveFlight = {
  id: string;
  callsign: string;
  heading: number;
  latitude: number;
  longitude: number;
  altitudeMeters: number | null;
  onGround: boolean;
};

export type FlightsSnapshotPayload = {
  flights: LiveFlight[];
  updatedAt: string;
  source: "OpenSky";
};

type OpenSkyStateVector = unknown[];

export type OpenSkyStatesResponseRaw = {
  time?: number;
  states?: OpenSkyStateVector[];
};

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function toLiveFlights(payload: OpenSkyStatesResponseRaw): LiveFlight[] {
  const states = Array.isArray(payload.states) ? payload.states : [];

  return states
    .map((state): LiveFlight | null => {
      if (!Array.isArray(state)) {
        return null;
      }

      const icao24 = asString(state[0])?.trim().toLowerCase();
      const callsignRaw = asString(state[1])?.trim() ?? "";
      const longitude = asFiniteNumber(state[5]);
      const latitude = asFiniteNumber(state[6]);
      const altitudeMeters = asFiniteNumber(state[13]) ?? asFiniteNumber(state[7]);
      const onGround = asBoolean(state[8]) ?? false;
      const heading = asFiniteNumber(state[10]) ?? 0;

      if (!icao24 || latitude === null || longitude === null) {
        return null;
      }

      return {
        id: `flight-${icao24}`,
        callsign: callsignRaw || icao24.toUpperCase(),
        heading,
        latitude,
        longitude,
        altitudeMeters,
        onGround
      };
    })
    .filter((flight): flight is LiveFlight => flight !== null);
}
