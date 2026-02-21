# KVG 3D Live Bus Viewer (Next.js + MapLibre + OSM)

Interactive 3D tracker for KVG buses in Kiel with an OpenStreetMap base layer and live data from the KVG Internet Service API.

## Features

- OpenStreetMap as a real base map (MapLibre)
- 3D bus visualization as extrusions on the road network
- Live vehicle positions (polling every 10 seconds)
- Stops as a live layer on the map
- Clickable buses with live details (ID, trip, heading, coordinates)
- Track display for the selected bus (trip path)
- Server-side API proxy via Next.js (`/api/kvg/snapshot`)

## Start

```bash
npm install
npm run dev
```

Then in the browser: `http://localhost:3000`

## API Notes

The data is fetched server-side via these endpoints:

- `.../vehicleinfo/vehicles` (POST, with cacheBuster and positionType=RAW)
- `.../stopinfo/stops` (POST, bounding box as form data)
- `.../pathinfo/trip` (POST, for the track of a selected trip)

This avoids CORS in the browser and allows the app to update cleanly in real time.
