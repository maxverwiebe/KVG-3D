import { NextResponse } from "next/server";

import {
  type KvgStopRaw,
  type KvgVehicleRaw,
  toLiveStop,
  toLiveVehicle
} from "@/lib/kvg";

const baseURL = "https://kvg-internetservice-proxy.p.networkteam.com";
const vehiclesURL = `${baseURL}/internetservice/geoserviceDispatcher/services/vehicleinfo/vehicles`;
const stopsURL = `${baseURL}/internetservice/geoserviceDispatcher/services/stopinfo/stops`;

const mapBounds = {
  top: "324000000",
  bottom: "-324000000",
  left: "-648000000",
  right: "648000000"
};

type VehiclesResponse = {
  vehicles?: KvgVehicleRaw[];
};

type StopsResponse = {
  stops?: KvgStopRaw[];
};

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

export async function GET() {
  try {
    const cacheBuster = Date.now();

    const [vehiclesRaw, stopsRaw] = (await Promise.all([
      post(`${vehiclesURL}?cacheBuster=${cacheBuster}&positionType=RAW`) as Promise<VehiclesResponse>,
      post(stopsURL, new URLSearchParams(mapBounds)) as Promise<StopsResponse>
    ])) as [VehiclesResponse, StopsResponse];

    const vehicles = (vehiclesRaw.vehicles ?? [])
      .filter(
        (vehicle) =>
          !vehicle.isDeleted &&
          Number.isFinite(vehicle.latitude) &&
          Number.isFinite(vehicle.longitude) &&
          vehicle.latitude !== 0 &&
          vehicle.longitude !== 0
      )
      .map(toLiveVehicle);

    const stops = (stopsRaw.stops ?? [])
      .filter(
        (stop) =>
          Number.isFinite(stop.latitude) &&
          Number.isFinite(stop.longitude) &&
          stop.latitude !== 0 &&
          stop.longitude !== 0
      )
      .map(toLiveStop);

    return NextResponse.json(
      {
        vehicles,
        stops,
        updatedAt: new Date().toISOString()
      },
      {
        headers: {
          "cache-control": "no-store, max-age=0"
        }
      }
    );
  } catch (error) {
    console.error("Failed loading KVG snapshot", error);

    return NextResponse.json(
      {
        message: "Live-Daten konnten nicht geladen werden."
      },
      { status: 502 }
    );
  }
}
