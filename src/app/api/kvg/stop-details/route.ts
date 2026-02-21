import { NextRequest, NextResponse } from "next/server";

const baseURL = "https://kvg-internetservice-proxy.p.networkteam.com";
const stopURL = `${baseURL}/internetservice/services/passageInfo/stopPassages/stop`;

type DepartureRaw = {
  tripId?: string;
  status?: string;
  plannedTime?: string;
  actualTime?: string;
  actualRelativeTime?: number;
  routeId?: string;
  patternText?: string;
  direction?: string;
  platform?: string;
};

type AlertRaw = {
  title?: string;
};

type RouteAlertRaw = {
  name?: string;
  alerts?: AlertRaw[];
};

type StopResponseRaw = {
  actual?: DepartureRaw[];
  generalAlerts?: AlertRaw[];
  routes?: RouteAlertRaw[];
};

type StopDeparture = {
  routeName: string;
  direction: string;
  etaMinutes: number | null;
  delayMinutes: number | null;
  platform: string | null;
};

type StopDetailsPayload = {
  stopShortName: string;
  departures: StopDeparture[];
  alerts: string[];
  updatedAt: string;
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

function parseClockOrDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate;
  }

  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const now = new Date();
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = Number.parseInt(match[3] ?? "0", 10);

  const date = new Date(now);
  date.setHours(hours, minutes, seconds, 0);

  return date;
}

function computeDelayMinutes(plannedTime: string | undefined, actualTime: string | undefined): number | null {
  const planned = parseClockOrDate(plannedTime);
  const actual = parseClockOrDate(actualTime);

  if (!planned || !actual) {
    return null;
  }

  const diffMinutes = Math.round((actual.getTime() - planned.getTime()) / 60000);

  if (Math.abs(diffMinutes) > 12 * 60) {
    return null;
  }

  return diffMinutes;
}

function normalizeMinutesDelta(minutes: number): number {
  if (minutes < -12 * 60) {
    return minutes + 24 * 60;
  }

  if (minutes > 12 * 60) {
    return minutes - 24 * 60;
  }

  return minutes;
}

function computeEtaFromTime(actualTime: string | undefined, plannedTime: string | undefined): number | null {
  const candidate = parseClockOrDate(actualTime) ?? parseClockOrDate(plannedTime);
  if (!candidate) {
    return null;
  }

  const diffMinutes = Math.round((candidate.getTime() - Date.now()) / 60000);
  return normalizeMinutesDelta(diffMinutes);
}

function normalizeEtaMinutes(raw: DepartureRaw): number | null {
  const etaFromTime = computeEtaFromTime(raw.actualTime, raw.plannedTime);
  const relativeRaw = raw.actualRelativeTime;

  if (!Number.isFinite(relativeRaw)) {
    return etaFromTime;
  }

  const relativeAsMinutes = Math.round(Number(relativeRaw));
  const relativeAsSecondsToMinutes = Math.round(Number(relativeRaw) / 60);

  if (etaFromTime !== null) {
    const deltaMinutes = Math.abs(relativeAsMinutes - etaFromTime);
    const deltaSeconds = Math.abs(relativeAsSecondsToMinutes - etaFromTime);

    if (deltaSeconds + 1 < deltaMinutes) {
      return relativeAsSecondsToMinutes;
    }

    return relativeAsMinutes;
  }

  // Heuristic fallback if no usable time is present.
  if (Math.abs(relativeAsMinutes) > 240) {
    return relativeAsSecondsToMinutes;
  }

  return relativeAsMinutes;
}

function normalizeDeparture(raw: DepartureRaw): StopDeparture {
  const etaMinutes = normalizeEtaMinutes(raw);

  return {
    routeName: raw.patternText || raw.routeId || "Linie",
    direction: raw.direction || "-",
    etaMinutes,
    delayMinutes: computeDelayMinutes(raw.plannedTime, raw.actualTime),
    platform: raw.platform || null
  };
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export async function GET(request: NextRequest) {
  const stopShortName = request.nextUrl.searchParams.get("stop");

  if (!stopShortName) {
    return NextResponse.json({ message: "stop ist erforderlich." }, { status: 400 });
  }

  try {
    const raw = (await post(stopURL, new URLSearchParams({ stop: stopShortName }))) as StopResponseRaw;

    const departures = (raw.actual ?? [])
      .map(normalizeDeparture)
      .filter(
        (departure) =>
          departure.etaMinutes === null ||
          (departure.etaMinutes >= -2 && departure.etaMinutes <= 6 * 60)
      )
      .sort((a, b) => {
        const aEta = a.etaMinutes ?? 99999;
        const bEta = b.etaMinutes ?? 99999;
        return aEta - bEta;
      });

    const generalAlerts = (raw.generalAlerts ?? []).map((alert) => alert.title || "");
    const routeAlerts = (raw.routes ?? []).flatMap((route) =>
      (route.alerts ?? []).map((alert) => `${route.name || "Linie"}: ${alert.title || ""}`)
    );

    const payload: StopDetailsPayload = {
      stopShortName,
      departures,
      alerts: uniq([...generalAlerts, ...routeAlerts]),
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json(payload, {
      headers: {
        "cache-control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    console.error("Failed loading KVG stop details", error);

    return NextResponse.json(
      {
        message: "Haltestellen-Abfahrten konnten nicht geladen werden."
      },
      { status: 502 }
    );
  }
}
