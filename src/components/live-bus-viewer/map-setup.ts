import maplibregl from "maplibre-gl";

import {
  EMPTY_STOPS,
  EMPTY_TRACK,
  EMPTY_VEHICLE_DIRECTION,
  EMPTY_VEHICLE_LABELS,
  EMPTY_VEHICLES
} from "@/components/live-bus-viewer/geojson-builders";

export const MAP_SOURCE_IDS = {
  stops: "kvg-stops",
  selectedTrack: "kvg-selected-track",
  vehicles: "kvg-vehicles",
  vehicleLabelPoints: "kvg-vehicle-label-points",
  vehicleDirection: "kvg-vehicle-direction"
} as const;

export const MAP_LAYER_IDS = {
  stops: "kvg-stops-layer",
  selectedStops: "kvg-stops-selected-layer",
  stopLabelsTrip: "kvg-stop-labels-trip",
  stopLabels: "kvg-stop-labels",
  trackGlow: "kvg-track-glow",
  trackLine: "kvg-track-line",
  vehicles: "kvg-vehicles-layer",
  vehicleOutline: "kvg-vehicle-outline",
  vehicleLabels: "kvg-vehicle-labels",
  vehicleDirectionLine: "kvg-vehicle-direction-line"
} as const;

const STOP_INTERACTION_LAYERS = [
  MAP_LAYER_IDS.stops,
  MAP_LAYER_IDS.selectedStops,
  MAP_LAYER_IDS.stopLabels,
  MAP_LAYER_IDS.stopLabelsTrip
] as const;

const POINTER_LAYERS = [MAP_LAYER_IDS.vehicles, ...STOP_INTERACTION_LAYERS] as const;

const INTERACTIVE_LAYERS = [MAP_LAYER_IDS.vehicles, ...STOP_INTERACTION_LAYERS] as const;

type VehicleClickPayload = {
  id: string;
  lat: number | null;
  lon: number | null;
};

type StopClickPayload = {
  shortName?: unknown;
  name?: unknown;
  lngLat: maplibregl.LngLat;
};

type MapInteractionHandlers = {
  onVehicleClick: (payload: VehicleClickPayload) => void;
  onStopClick: (payload: StopClickPayload) => void;
  onBackgroundClick: () => void;
};

export function addKvgSourcesAndLayers(map: maplibregl.Map): void {
  map.addSource(MAP_SOURCE_IDS.stops, {
    type: "geojson",
    data: EMPTY_STOPS
  });

  map.addLayer({
    id: MAP_LAYER_IDS.stops,
    type: "circle",
    source: MAP_SOURCE_IDS.stops,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 1.8, 15, 4.2],
      "circle-color": "#1f4de3",
      "circle-opacity": 0.3,
      "circle-stroke-width": 0.8,
      "circle-stroke-color": "#f7fbff"
    }
  });

  map.addLayer({
    id: MAP_LAYER_IDS.selectedStops,
    type: "circle",
    source: MAP_SOURCE_IDS.stops,
    filter: ["==", ["get", "isTripStop"], 1],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3.2, 15, 6.1],
      "circle-color": "#ff7a00",
      "circle-opacity": 0.95,
      "circle-stroke-width": 1.2,
      "circle-stroke-color": "#fff6ed"
    }
  });

  map.addLayer({
    id: MAP_LAYER_IDS.stopLabelsTrip,
    type: "symbol",
    source: MAP_SOURCE_IDS.stops,
    minzoom: 11.8,
    filter: ["==", ["get", "isTripStop"], 1],
    layout: {
      "text-field": ["coalesce", ["get", "name"], ["get", "shortName"], ["get", "id"]],
      "text-font": ["Open Sans Semibold", "Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11.5, 17, 14],
      "text-anchor": "top",
      "text-offset": [0, 1.05],
      "text-allow-overlap": false
    },
    paint: {
      "text-color": "#8a3f00",
      "text-halo-color": "rgba(255,255,255,0.98)",
      "text-halo-width": 1.8
    }
  });

  map.addLayer({
    id: MAP_LAYER_IDS.stopLabels,
    type: "symbol",
    source: MAP_SOURCE_IDS.stops,
    minzoom: 14,
    filter: ["==", ["get", "isTripStop"], 0],
    layout: {
      "text-field": ["coalesce", ["get", "name"], ["get", "shortName"], ["get", "id"]],
      "text-font": ["Open Sans Regular", "Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 17, 12.5],
      "text-anchor": "top",
      "text-offset": [0, 0.95],
      "text-allow-overlap": false,
      visibility: "none"
    },
    paint: {
      "text-color": "#556176",
      "text-halo-color": "rgba(255,255,255,0.95)",
      "text-halo-width": 1.4
    }
  });

  map.addSource(MAP_SOURCE_IDS.selectedTrack, {
    type: "geojson",
    data: EMPTY_TRACK
  });

  map.addLayer({
    id: MAP_LAYER_IDS.trackGlow,
    type: "line",
    source: MAP_SOURCE_IDS.selectedTrack,
    paint: {
      "line-color": "#ffb25d",
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 5, 16, 12],
      "line-opacity": 0.35,
      "line-blur": 1.2
    }
  });

  map.addLayer({
    id: MAP_LAYER_IDS.trackLine,
    type: "line",
    source: MAP_SOURCE_IDS.selectedTrack,
    paint: {
      "line-color": "#ff6a00",
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.2, 16, 4.6],
      "line-opacity": 0.95
    }
  });

  map.addSource(MAP_SOURCE_IDS.vehicles, {
    type: "geojson",
    data: EMPTY_VEHICLES
  });

  map.addSource(MAP_SOURCE_IDS.vehicleLabelPoints, {
    type: "geojson",
    data: EMPTY_VEHICLE_LABELS
  });

  map.addSource(MAP_SOURCE_IDS.vehicleDirection, {
    type: "geojson",
    data: EMPTY_VEHICLE_DIRECTION
  });

  map.addLayer({
    id: MAP_LAYER_IDS.vehicles,
    type: "fill-extrusion",
    source: MAP_SOURCE_IDS.vehicles,
    paint: {
      "fill-extrusion-color": ["case", ["==", ["get", "selected"], 1], "#ff8b2a", "#00acc1"],
      "fill-extrusion-height": ["case", ["==", ["get", "selected"], 1], 12, 8],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.9
    }
  });

  map.addLayer({
    id: MAP_LAYER_IDS.vehicleOutline,
    type: "line",
    source: MAP_SOURCE_IDS.vehicles,
    paint: {
      "line-color": ["case", ["==", ["get", "selected"], 1], "#9f4b00", "#005a70"],
      "line-width": 1.2
    }
  });

  map.addLayer({
    id: MAP_LAYER_IDS.vehicleLabels,
    type: "symbol",
    source: MAP_SOURCE_IDS.vehicleLabelPoints,
    minzoom: 12.2,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Open Sans Semibold", "Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 12.2, 10.5, 16, 13],
      "text-anchor": "bottom",
      "text-offset": [0, -1],
      "text-allow-overlap": false,
      visibility: "none"
    },
    paint: {
      "text-color": ["case", ["==", ["get", "selected"], 1], "#8a3f00", "#334155"],
      "text-halo-color": "rgba(255,255,255,0.95)",
      "text-halo-width": 1.6
    }
  });

  map.addLayer({
    id: MAP_LAYER_IDS.vehicleDirectionLine,
    type: "line",
    source: MAP_SOURCE_IDS.vehicleDirection,
    layout: {
      "line-cap": "round",
      "line-join": "round"
    },
    paint: {
      "line-color": "#ff6a00",
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2.1, 16, 4.4],
      "line-opacity": 0.95
    }
  });
}

export function registerMapInteractionHandlers(
  map: maplibregl.Map,
  handlers: MapInteractionHandlers
): void {
  for (const layerId of POINTER_LAYERS) {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  }

  map.on("click", MAP_LAYER_IDS.vehicles, (event) => {
    const feature = event.features?.[0];
    const properties = feature?.properties as Record<string, unknown> | undefined;
    if (!properties || typeof properties.id !== "string") {
      return;
    }

    const lat = Number(properties.lat);
    const lon = Number(properties.lon);

    handlers.onVehicleClick({
      id: properties.id,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null
    });
  });

  for (const layerId of STOP_INTERACTION_LAYERS) {
    map.on("click", layerId, (event) => {
      const feature = event.features?.[0];
      const properties = feature?.properties as Record<string, unknown> | undefined;
      if (!properties) {
        return;
      }

      handlers.onStopClick({
        shortName: properties.shortName,
        name: properties.name,
        lngLat: event.lngLat
      });
    });
  }

  map.on("click", (event) => {
    const hit = map.queryRenderedFeatures(event.point, {
      layers: [...INTERACTIVE_LAYERS]
    });

    if (!hit.length) {
      handlers.onBackgroundClick();
    }
  });
}

export function setNameTagVisibility(
  map: maplibregl.Map,
  showVehicleNameTags: boolean,
  showStopNameTags: boolean
): void {
  if (map.getLayer(MAP_LAYER_IDS.vehicleLabels)) {
    map.setLayoutProperty(MAP_LAYER_IDS.vehicleLabels, "visibility", showVehicleNameTags ? "visible" : "none");
  }

  if (map.getLayer(MAP_LAYER_IDS.stopLabels)) {
    map.setLayoutProperty(MAP_LAYER_IDS.stopLabels, "visibility", showStopNameTags ? "visible" : "none");
  }
}
