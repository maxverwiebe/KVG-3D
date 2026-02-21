# KVG 3D Live Bus Viewer (Next.js + MapLibre + OSM)

Interaktiver 3D-Tracker fur KVG-Busse in Kiel mit OpenStreetMap-Untergrund und Live-Daten aus der KVG Internetservice API.

## Features

- OpenStreetMap als echte Basiskarte (MapLibre)
- 3D-Busdarstellung als Extrusionen auf dem Strassennetz
- Live-Fahrzeugpositionen (Polling alle 10 Sekunden)
- Haltestellen als Live-Layer auf der Karte
- Klickbare Busse mit Live-Details (ID, Trip, Heading, Koordinaten)
- Track-Anzeige fur den ausgewaehlten Bus (Trip-Pfad)
- Server-seitiger API-Proxy uber Next.js (`/api/kvg/snapshot`)

## Start

```bash
npm install
npm run dev
```

Danach im Browser: `http://localhost:3000`

## API-Hinweise

Die Daten werden serverseitig uber diese Endpunkte geholt:

- `.../vehicleinfo/vehicles` (POST, mit `cacheBuster` und `positionType=RAW`)
- `.../stopinfo/stops` (POST, Bounding Box als Form-Data)
- `.../pathinfo/trip` (POST, fur den Track eines ausgewaehlten Trips)

Damit wird CORS im Browser vermieden und die App kann sauber live aktualisieren.
