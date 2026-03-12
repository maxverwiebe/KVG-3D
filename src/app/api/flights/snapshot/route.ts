import { NextResponse } from "next/server";

import type { LiveFlight, OpenSkyStatesResponseRaw } from "@/lib/flights";
import { toLiveFlights } from "@/lib/flights";

const OPENSKY_URL = "https://opensky-network.org/api/states/all";

// Bounding box around Kiel region (WGS84 decimal degrees)
const KIEL_FLIGHT_BOUNDS = {
  lamin: "54.18",
  lomin: "9.82",
  lamax: "54.56",
  lomax: "10.55"
} as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const params = new URLSearchParams(KIEL_FLIGHT_BOUNDS);
    const response = await fetch(`${OPENSKY_URL}?${params.toString()}`, {
      cache: "no-store",
      next: { revalidate: 0 },
      headers: {
        accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`OpenSky request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as OpenSkyStatesResponseRaw;
    const flights = toLiveFlights(payload).filter((flight) => !flight.onGround);

    // Testflugzeug (zum Deaktivieren einfach diesen Block auskommentieren)
    const testFlight: LiveFlight = {
      id: "flight-test-kiel-001",
      callsign: "TEST123",
      heading: 72,
      latitude: 54.385,
      longitude: 10.215,
      altitudeMeters: 1200,
      onGround: false
    };
    flights.unshift(testFlight);

    return NextResponse.json(
      {
        flights,
        source: "OpenSky",
        updatedAt: new Date().toISOString()
      },
      {
        headers: {
          "cache-control": "no-store, max-age=0"
        }
      }
    );
  } catch (error) {
    console.error("Failed loading flight snapshot", error);

    return NextResponse.json(
      {
        message: "Flugdaten konnten nicht geladen werden."
      },
      { status: 502 }
    );
  }
}
