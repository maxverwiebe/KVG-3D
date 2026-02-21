import { NextRequest, NextResponse } from "next/server";

import {
  decodeCoordinate,
  ID_PREFIX,
  stripIdPrefix,
  type KvgTripStopRaw,
  type KvgTripStopsResponseRaw,
  type LiveStop,
  type TripStopsPayload
} from "@/lib/kvg";

const baseURL = "https://kvg-internetservice-proxy.p.networkteam.com";
const tripURL = `${baseURL}/internetservice/services/tripInfo/tripPassages`;

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function post(url: string, data?: URLSearchParams): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: data?.toString() ?? "",
    cache: "no-store",
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`KVG request failed with status ${response.status}`);
  }

  return response.json();
}

function parseTripStop(stopRaw: KvgTripStopRaw | undefined): LiveStop | null {
  const stop = stopRaw?.stop;
  if (!stop?.shortName) {
    return null;
  }

  const latitudeRaw = stop.latitude;
  const longitudeRaw = stop.longitude;

  const latitude = Number.isFinite(latitudeRaw) ? decodeCoordinate(Number(latitudeRaw)) : NaN;
  const longitude = Number.isFinite(longitudeRaw) ? decodeCoordinate(Number(longitudeRaw)) : NaN;

  return {
    id: `${ID_PREFIX}${stop.shortName}`,
    shortName: stop.shortName,
    name: stop.name ?? stop.shortName,
    latitude,
    longitude
  };
}

export async function GET(request: NextRequest) {
  const tripId = request.nextUrl.searchParams.get("tripId");

  if (!tripId) {
    return NextResponse.json({ message: "tripId ist erforderlich." }, { status: 400 });
  }

  const rawTripId = stripIdPrefix(tripId);

  try {
    const response = (await post(tripURL, new URLSearchParams({ tripId: rawTripId }))) as KvgTripStopsResponseRaw;

    const rawStops = [...(response.old ?? []), ...(response.actual ?? [])];

    const dedupe = new Map<string, LiveStop>();
    for (const rawStop of rawStops) {
      const parsed = parseTripStop(rawStop);
      if (!parsed || dedupe.has(parsed.id)) {
        continue;
      }

      dedupe.set(parsed.id, parsed);
    }

    const payload: TripStopsPayload = {
      tripId: `${ID_PREFIX}${rawTripId}`,
      stops: [...dedupe.values()]
    };

    return NextResponse.json(payload, {
      headers: {
        "cache-control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    console.error("Failed loading KVG trip stops", error);

    return NextResponse.json(
      {
        message: "Trip-Haltestellen konnten nicht geladen werden."
      },
      { status: 502 }
    );
  }
}
