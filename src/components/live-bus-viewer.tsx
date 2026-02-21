"use client";

import type { GeoJSONSource } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  KIEL_BOUNDS,
  MAX_STOPS_IN_MAP,
  MAX_VEHICLES_IN_LIST,
  OSM_STYLE,
  POLL_INTERVAL_MS
} from "@/components/live-bus-viewer/constants";
import {
  buildStopCollection,
  buildTrackCollection,
  buildVehicleCollection,
  buildVehicleDirectionCollection,
  buildVehicleLabelCollection
} from "@/components/live-bus-viewer/geojson-builders";
import {
  addKvgSourcesAndLayers,
  MAP_SOURCE_IDS,
  registerMapInteractionHandlers,
  setNameTagVisibility
} from "@/components/live-bus-viewer/map-setup";
import { formatTimestamp, renderStopPopupContent } from "@/components/live-bus-viewer/popup-content";
import { buildSearchResults, buildSearchableStops } from "@/components/live-bus-viewer/search";
import type { SearchResult, StopDetailsPayload } from "@/components/live-bus-viewer/types";
import {
  KIEL_CENTER,
  type LiveStop,
  type LiveVehicle,
  type SnapshotPayload,
  type TripPathPayload,
  type TripStopsPayload
} from "@/lib/kvg";

export default function LiveBusViewer() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const stopPopupRef = useRef<maplibregl.Popup | null>(null);
  const stopPopupAbortRef = useRef<AbortController | null>(null);
  const toolbarSearchRef = useRef<HTMLDivElement>(null);

  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [stops, setStops] = useState<LiveStop[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<[number, number][]>([]);
  const [selectedTripStops, setSelectedTripStops] = useState<LiveStop[]>([]);
  const [trackTripId, setTrackTripId] = useState<string | null>(null);
  const [isTrackLoading, setIsTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [showVehicleNameTags, setShowVehicleNameTags] = useState(false);
  const [showStopNameTags, setShowStopNameTags] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId]
  );

  const searchableStops = useMemo(
    () => buildSearchableStops(stops, selectedTripStops),
    [selectedTripStops, stops]
  );

  const searchResults = useMemo(
    () => buildSearchResults(mapSearchQuery, vehicles, searchableStops),
    [mapSearchQuery, searchableStops, vehicles]
  );

  const vehicleCollection = useMemo(
    () => buildVehicleCollection(vehicles, selectedVehicleId),
    [vehicles, selectedVehicleId]
  );

  const stopCollection = useMemo(
    () => buildStopCollection(stops, selectedTripStops),
    [selectedTripStops, stops]
  );

  const vehicleLabelCollection = useMemo(
    () => buildVehicleLabelCollection(vehicles, selectedVehicleId),
    [vehicles, selectedVehicleId]
  );

  const vehicleDirectionCollection = useMemo(
    () => buildVehicleDirectionCollection(selectedVehicle),
    [selectedVehicle]
  );

  const trackCollection = useMemo(
    () => buildTrackCollection(trackTripId, selectedTrack),
    [selectedTrack, trackTripId]
  );

  const focusVehicle = useCallback((vehicle: LiveVehicle) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.easeTo({
      center: [vehicle.longitude, vehicle.latitude],
      zoom: Math.max(map.getZoom(), 15.2),
      pitch: Math.max(map.getPitch(), 58),
      duration: 680
    });
  }, []);

  const openStopPopup = useCallback(
    async (stopProperties: { shortName?: unknown; name?: unknown }, lngLat: maplibregl.LngLat) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      const stopShortName =
        typeof stopProperties.shortName === "string" ? stopProperties.shortName.trim() : "";
      const stopName =
        typeof stopProperties.name === "string" && stopProperties.name.trim().length > 0
          ? stopProperties.name.trim()
          : stopShortName || "Haltestelle";

      if (!stopShortName) {
        return;
      }

      stopPopupAbortRef.current?.abort();
      const abortController = new AbortController();
      stopPopupAbortRef.current = abortController;

      if (!stopPopupRef.current) {
        stopPopupRef.current = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: "360px"
        });
      }

      const popup = stopPopupRef.current;
      popup
        .setLngLat(lngLat)
        .setHTML(renderStopPopupContent(stopName, null, true))
        .addTo(map);

      try {
        const response = await fetch(`/api/kvg/stop-details?stop=${encodeURIComponent(stopShortName)}`, {
          cache: "no-store",
          signal: abortController.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as StopDetailsPayload;
        if (abortController.signal.aborted || !stopPopupRef.current) {
          return;
        }

        stopPopupRef.current
          .setLngLat(lngLat)
          .setHTML(renderStopPopupContent(stopName, payload, false));
      } catch {
        if (abortController.signal.aborted || !stopPopupRef.current) {
          return;
        }

        stopPopupRef.current
          .setLngLat(lngLat)
          .setHTML(renderStopPopupContent(stopName, null, false));
      }
    },
    []
  );

  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      setMapSearchQuery(result.title);
      setIsSearchOpen(false);

      if (result.kind === "vehicle") {
        setSelectedVehicleId(result.vehicle.id);
        focusVehicle(result.vehicle);
        return;
      }

      const map = mapRef.current;
      if (map) {
        map.easeTo({
          center: [result.stop.longitude, result.stop.latitude],
          zoom: Math.max(map.getZoom(), 15.3),
          pitch: Math.max(map.getPitch(), 58),
          duration: 680
        });
      }

      void openStopPopup(
        {
          shortName: result.stop.shortName,
          name: result.stop.name
        },
        new maplibregl.LngLat(result.stop.longitude, result.stop.latitude)
      );
    },
    [focusVehicle, openStopPopup]
  );

  const writeSources = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const vehicleSource = map.getSource(MAP_SOURCE_IDS.vehicles) as GeoJSONSource | undefined;
    const stopSource = map.getSource(MAP_SOURCE_IDS.stops) as GeoJSONSource | undefined;
    const vehicleLabelSource = map.getSource(MAP_SOURCE_IDS.vehicleLabelPoints) as GeoJSONSource | undefined;
    const vehicleDirectionSource = map.getSource(MAP_SOURCE_IDS.vehicleDirection) as GeoJSONSource | undefined;
    const trackSource = map.getSource(MAP_SOURCE_IDS.selectedTrack) as GeoJSONSource | undefined;

    if (vehicleSource) {
      vehicleSource.setData(vehicleCollection);
    }

    if (stopSource) {
      stopSource.setData(stopCollection);
    }

    if (vehicleLabelSource) {
      vehicleLabelSource.setData(vehicleLabelCollection);
    }

    if (vehicleDirectionSource) {
      vehicleDirectionSource.setData(vehicleDirectionCollection);
    }

    if (trackSource) {
      trackSource.setData(trackCollection);
    }
  }, [
    mapReady,
    stopCollection,
    trackCollection,
    vehicleCollection,
    vehicleDirectionCollection,
    vehicleLabelCollection
  ]);

  const fetchSnapshot = useCallback(async () => {
    try {
      const response = await fetch("/api/kvg/snapshot", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as SnapshotPayload;
      setVehicles(payload.vehicles ?? []);
      setStops(payload.stops ?? []);
      setUpdatedAt(payload.updatedAt ?? new Date().toISOString());
      setError(null);
    } catch {
      setError("Live-Feed ist aktuell nicht erreichbar.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_STYLE,
      center: [KIEL_CENTER.longitude, KIEL_CENTER.latitude],
      zoom: 12.4,
      pitch: 58,
      bearing: -16,
      maxBounds: KIEL_BOUNDS
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }));

    map.on("load", () => {
      addKvgSourcesAndLayers(map);

      registerMapInteractionHandlers(map, {
        onVehicleClick: ({ id, lat, lon }) => {
          setSelectedVehicleId(id);

          if (lat !== null && lon !== null) {
            map.easeTo({
              center: [lon, lat],
              zoom: Math.max(map.getZoom(), 15.2),
              pitch: Math.max(map.getPitch(), 58),
              duration: 680
            });
          }
        },
        onStopClick: ({ shortName, name, lngLat }) => {
          void openStopPopup({ shortName, name }, lngLat);
        },
        onBackgroundClick: () => {
          setSelectedVehicleId(null);
          stopPopupRef.current?.remove();
        }
      });

      setMapReady(true);
    });

    return () => {
      stopPopupAbortRef.current?.abort();
      stopPopupRef.current?.remove();
      stopPopupRef.current = null;

      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [openStopPopup]);

  useEffect(() => {
    void fetchSnapshot();

    const interval = setInterval(() => {
      void fetchSnapshot();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [fetchSnapshot]);

  useEffect(() => {
    const selectedTripId = selectedVehicle?.tripId;

    if (!selectedTripId) {
      setSelectedTrack([]);
      setSelectedTripStops([]);
      setTrackTripId(null);
      setTrackError(null);
      setIsTrackLoading(false);
      return;
    }

    const abortController = new AbortController();
    let isCurrent = true;

    setTrackTripId(selectedTripId);
    setTrackError(null);
    setIsTrackLoading(true);

    const loadTrack = async () => {
      const [pathResult, stopsResult] = await Promise.allSettled([
        fetch(`/api/kvg/trip-path?tripId=${encodeURIComponent(selectedTripId)}`, {
          cache: "no-store",
          signal: abortController.signal
        }),
        fetch(`/api/kvg/trip-stops?tripId=${encodeURIComponent(selectedTripId)}`, {
          cache: "no-store",
          signal: abortController.signal
        })
      ]);

      if (abortController.signal.aborted || !isCurrent) {
        return;
      }

      if (pathResult.status === "fulfilled" && pathResult.value.ok) {
        const pathPayload = (await pathResult.value.json()) as TripPathPayload;
        if (isCurrent) {
          setSelectedTrack(pathPayload.path ?? []);
          setTrackError(null);
        }
      } else if (isCurrent) {
        setSelectedTrack([]);
        setTrackError("Track konnte nicht geladen werden.");
      }

      if (stopsResult.status === "fulfilled" && stopsResult.value.ok) {
        const stopsPayload = (await stopsResult.value.json()) as TripStopsPayload;
        if (isCurrent) {
          setSelectedTripStops(stopsPayload.stops ?? []);
        }
      } else if (isCurrent) {
        setSelectedTripStops([]);
      }

      if (isCurrent && !abortController.signal.aborted) {
        setIsTrackLoading(false);
      }
    };

    void loadTrack().catch(() => {
      if (abortController.signal.aborted || !isCurrent) {
        return;
      }

      setSelectedTrack([]);
      setSelectedTripStops([]);
      setTrackError("Track konnte nicht geladen werden.");
      setIsTrackLoading(false);
    });

    return () => {
      isCurrent = false;
      abortController.abort();
    };
  }, [selectedVehicle?.tripId]);

  useEffect(() => {
    writeSources();
  }, [writeSources]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    setNameTagVisibility(map, showVehicleNameTags, showStopNameTags);
  }, [mapReady, showStopNameTags, showVehicleNameTags]);

  useEffect(() => {
    if (selectedVehicleId && !vehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
      setSelectedVehicleId(null);
    }
  }, [vehicles, selectedVehicleId]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 980px)");
    const updatePanelState = () => {
      setIsPanelOpen(!query.matches);
    };

    updatePanelState();
    query.addEventListener("change", updatePanelState);

    return () => {
      query.removeEventListener("change", updatePanelState);
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!toolbarSearchRef.current) {
        return;
      }

      const target = event.target as Node | null;
      if (target && !toolbarSearchRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="viewer-shell">
      <section className="viewer-stage" aria-label="3D Karte mit OpenStreetMap">
        <div ref={mapContainerRef} className="map-canvas" />

        <div className="viewer-toolbar">
          <div className="toolbar-left" ref={toolbarSearchRef}>
            <div className="toolbar-brand">
              <span>KVG</span>
              <strong>3D Live</strong>
            </div>

            <div className="toolbar-search">
              <input
                type="search"
                className="toolbar-search-input"
                placeholder="Bus oder Haltestelle suchen..."
                value={mapSearchQuery}
                onChange={(event) => {
                  setMapSearchQuery(event.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && searchResults.length > 0) {
                    event.preventDefault();
                    handleSearchSelect(searchResults[0]);
                  }
                }}
              />

              {mapSearchQuery && (
                <button
                  type="button"
                  className="toolbar-search-clear"
                  onClick={() => {
                    setMapSearchQuery("");
                    setIsSearchOpen(false);
                  }}
                  aria-label="Suche zuruecksetzen"
                >
                  Reset
                </button>
              )}

              {isSearchOpen && mapSearchQuery.trim().length > 0 && (
                <div className="toolbar-search-dropdown" role="listbox" aria-label="Suche Treffer">
                  {searchResults.map((result) => (
                    <button
                      key={result.key}
                      type="button"
                      className="toolbar-search-item"
                      onClick={() => handleSearchSelect(result)}
                    >
                      <span className="toolbar-search-item-main">
                        <strong>{result.title}</strong>
                        <small>{result.subtitle}</small>
                      </span>
                      <span className="toolbar-search-item-kind">
                        {result.kind === "vehicle" ? "Bus" : "Haltestelle"}
                      </span>
                    </button>
                  ))}

                  {searchResults.length === 0 && (
                    <p className="toolbar-search-empty">Keine Treffer.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="toolbar-actions">
            <button
              type="button"
              className="toolbar-button"
              onClick={() => setIsPanelOpen((value) => !value)}
            >
              {isPanelOpen ? "Panel ausblenden" : "Panel einblenden"}
            </button>
          </div>
        </div>

        {(isLoading || error) && (
          <div className="viewer-overlay">
            {isLoading && <p>Daten werden geladen...</p>}
            {error && <p>{error}</p>}
          </div>
        )}
      </section>

      <aside className={isPanelOpen ? "viewer-panel is-open" : "viewer-panel"}>
        <div className="panel-chrome">
          <h2 className="panel-title">Live Panel</h2>
          <button
            type="button"
            className="toolbar-button panel-close"
            onClick={() => setIsPanelOpen(false)}
          >
            Schliessen
          </button>
        </div>

        <div className="panel-body">
          <section className="panel-block">
            <div className="panel-header">
              <h3>Status</h3>
              <span className={error ? "status-chip is-error" : "status-chip"}>{error ? "offline" : "live"}</span>
            </div>

            <div className="stats-grid">
              <article className="stat-card">
                <span>Fahrzeuge</span>
                <strong>{vehicles.length}</strong>
              </article>
              <article className="stat-card">
                <span>Haltestellen</span>
                <strong>{Math.min(stops.length, MAX_STOPS_IN_MAP)}</strong>
              </article>
              <article className="stat-card">
                <span>Update</span>
                <strong>{formatTimestamp(updatedAt)}</strong>
              </article>
              <article className="stat-card">
                <span>Intervall</span>
                <strong>{POLL_INTERVAL_MS / 1000}s</strong>
              </article>
            </div>

            <div className="toggle-grid">
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={showVehicleNameTags}
                  onChange={(event) => setShowVehicleNameTags(event.target.checked)}
                />
                <span>Bus-Nametags</span>
              </label>

              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={showStopNameTags}
                  onChange={(event) => setShowStopNameTags(event.target.checked)}
                />
                <span>Haltestellen-Nametags</span>
              </label>
            </div>
          </section>

          <section className="panel-block">
            <div className="panel-header">
              <h3>Ausgewahlter Bus</h3>
            </div>

            {!selectedVehicle && (
              <p className="panel-empty">Bus in Karte oder Liste waehlen, um Details und Track zu sehen.</p>
            )}

            {selectedVehicle && (
              <dl className="kv-list">
                <div className="kv-row">
                  <dt>Name</dt>
                  <dd>{selectedVehicle.name || "-"}</dd>
                </div>
                <div className="kv-row">
                  <dt>Vehicle</dt>
                  <dd>
                    <code>{selectedVehicle.id}</code>
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>Trip</dt>
                  <dd>
                    <code>{selectedVehicle.tripId}</code>
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>Richtung</dt>
                  <dd>{Math.round(selectedVehicle.heading)}deg</dd>
                </div>
                <div className="kv-row">
                  <dt>Track</dt>
                  <dd>
                    {isTrackLoading
                      ? "wird geladen..."
                      : trackError
                        ? trackError
                        : selectedTrack.length > 1
                          ? `${selectedTrack.length} Punkte`
                          : "kein Track verfuegbar"}
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>Stops</dt>
                  <dd>{selectedTripStops.length}</dd>
                </div>
                <div className="kv-row">
                  <dt>Position</dt>
                  <dd>{selectedVehicle.latitude.toFixed(5)}, {selectedVehicle.longitude.toFixed(5)}</dd>
                </div>
              </dl>
            )}
          </section>

          <section className="panel-block panel-buses">
            <div className="panel-header">
              <h3>Live Busse</h3>
              <span className="panel-meta">{vehicles.length}</span>
            </div>

            <div className="vehicle-list" role="list">
              {vehicles.slice(0, MAX_VEHICLES_IN_LIST).map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  className={vehicle.id === selectedVehicleId ? "vehicle-item is-active" : "vehicle-item"}
                  onClick={() => {
                    setSelectedVehicleId(vehicle.id);
                    focusVehicle(vehicle);
                  }}
                >
                  <span>{vehicle.name || vehicle.id}</span>
                  <small>{vehicle.tripId}</small>
                </button>
              ))}
              {!vehicles.length && (
                <p className="panel-empty">Keine Busse live gefunden.</p>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
