import type { LiveStop, LiveVehicle } from "@/lib/kvg";

export type VehicleProperties = {
  id: string;
  name: string;
  tripId: string;
  heading: number;
  lat: number;
  lon: number;
  selected: 0 | 1;
};

export type StopProperties = {
  id: string;
  shortName: string;
  name: string;
  isTripStop: 0 | 1;
};

export type VehicleLabelProperties = {
  id: string;
  name: string;
  selected: 0 | 1;
};

export type TrackProperties = {
  tripId: string;
};

export type VehicleDirectionProperties = {
  id: string;
};

export type StopDeparture = {
  routeName: string;
  direction: string;
  etaMinutes: number | null;
  delayMinutes: number | null;
  platform: string | null;
};

export type StopDetailsPayload = {
  stopShortName: string;
  departures: StopDeparture[];
  alerts: string[];
  updatedAt: string;
};

export type SearchResult =
  | {
      kind: "vehicle";
      key: string;
      title: string;
      subtitle: string;
      vehicle: LiveVehicle;
    }
  | {
      kind: "stop";
      key: string;
      title: string;
      subtitle: string;
      stop: LiveStop;
    };
