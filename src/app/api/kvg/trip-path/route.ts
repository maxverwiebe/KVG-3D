import { NextRequest, NextResponse } from "next/server";

import {
  decodeCoordinate,
  ID_PREFIX,
  stripIdPrefix,
  type KvgTripPathResponseRaw,
  type TripPathPayload
} from "@/lib/kvg";

const baseURL = "https://kvg-internetservice-proxy.p.networkteam.com";
const tripPathURL = `${baseURL}/internetservice/geoserviceDispatcher/services/pathinfo/trip`;

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

export async function GET(request: NextRequest) {
  const tripId = request.nextUrl.searchParams.get("tripId");

  if (!tripId) {
    return NextResponse.json({ message: "tripId ist erforderlich." }, { status: 400 });
  }

  const rawTripId = stripIdPrefix(tripId);

  try {
    const tripPathRaw = (await post(tripPathURL, new URLSearchParams({ id: rawTripId }))) as KvgTripPathResponseRaw;

    const wayPoints = tripPathRaw.paths?.[0]?.wayPoints ?? [];
    const path = wayPoints
      .filter(
        (waypoint) =>
          Number.isFinite(waypoint.lat) &&
          Number.isFinite(waypoint.lon) &&
          waypoint.lat !== 0 &&
          waypoint.lon !== 0
      )
      .map((waypoint) => [decodeCoordinate(waypoint.lon), decodeCoordinate(waypoint.lat)] as [number, number]);

    const payload: TripPathPayload = {
      tripId: `${ID_PREFIX}${rawTripId}`,
      path
    };

    return NextResponse.json(payload, {
      headers: {
        "cache-control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    console.error("Failed loading KVG trip path", error);

    return NextResponse.json(
      {
        message: "Trip-Track konnte nicht geladen werden."
      },
      { status: 502 }
    );
  }
}
