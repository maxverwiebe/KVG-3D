import type { StyleSpecification } from "maplibre-gl";

export const POLL_INTERVAL_MS = 10_000;
export const MAX_STOPS_IN_MAP = 4_000;
export const MAX_VEHICLES_IN_LIST = 120;
export const MAX_POPUP_DEPARTURES = 8;
export const MAX_SEARCH_RESULTS = 12;

export const KIEL_BOUNDS: [[number, number], [number, number]] = [
  [9.94, 54.22],
  [10.34, 54.43]
];

export const OSM_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "Map data (c) OpenStreetMap contributors"
    }
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#eef2f5"
      }
    },
    {
      id: "osm-raster",
      type: "raster",
      source: "osm",
      paint: {
        "raster-saturation": -1,
        "raster-contrast": -0.12,
        "raster-brightness-min": 0.22,
        "raster-brightness-max": 0.96,
        "raster-opacity": 0.9
      }
    }
  ]
};
