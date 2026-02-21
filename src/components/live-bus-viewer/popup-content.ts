import { MAX_POPUP_DEPARTURES } from "@/components/live-bus-viewer/constants";
import type { StopDetailsPayload } from "@/components/live-bus-viewer/types";

export function formatTimestamp(isoDate: string | null): string {
  if (!isoDate) {
    return "-";
  }

  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(isoDate));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatEtaLabel(etaMinutes: number | null): string {
  if (etaMinutes === null || !Number.isFinite(etaMinutes)) {
    return "-";
  }

  return `${Math.max(0, Math.round(etaMinutes))} min`;
}

function formatDelayLabel(delayMinutes: number | null): string {
  if (delayMinutes === null || !Number.isFinite(delayMinutes)) {
    return "k.A.";
  }

  if (delayMinutes <= 0) {
    return "puenktlich";
  }

  return `+${Math.round(delayMinutes)} min`;
}

export function renderStopPopupContent(
  stopName: string,
  data: StopDetailsPayload | null,
  loading: boolean
): string {
  const title = escapeHtml(stopName);

  if (loading) {
    return `
      <div class="stop-popup">
        <h4>${title}</h4>
        <p class="stop-popup-empty">Ankuenfte werden geladen...</p>
      </div>
    `;
  }

  if (!data) {
    return `
      <div class="stop-popup">
        <h4>${title}</h4>
        <p class="stop-popup-empty">Ankuenfte konnten nicht geladen werden.</p>
      </div>
    `;
  }

  const departures = data.departures.slice(0, MAX_POPUP_DEPARTURES);
  const rows = departures
    .map((departure) => {
      const routeName = escapeHtml(departure.routeName || "-");
      const direction = escapeHtml(departure.direction || "-");
      const eta = escapeHtml(formatEtaLabel(departure.etaMinutes));
      const delay = escapeHtml(formatDelayLabel(departure.delayMinutes));
      const delayClass =
        departure.delayMinutes !== null && Number.isFinite(departure.delayMinutes) && departure.delayMinutes > 0
          ? "is-late"
          : "is-on-time";
      const platform = departure.platform ? ` · Steig ${escapeHtml(departure.platform)}` : "";

      return `
        <li class="stop-popup-row">
          <div class="stop-popup-main">
            <strong>${routeName}</strong>
            <span>${direction}${platform}</span>
          </div>
          <div class="stop-popup-times">
            <span>${eta}</span>
            <span class="${delayClass}">${delay}</span>
          </div>
        </li>
      `;
    })
    .join("");

  const alerts = data.alerts.slice(0, 2);
  const alertsHtml =
    alerts.length > 0
      ? `<p class="stop-popup-alert">${alerts.map((alert) => escapeHtml(alert)).join(" · ")}</p>`
      : "";

  if (!rows) {
    return `
      <div class="stop-popup">
        <h4>${title}</h4>
        <p class="stop-popup-empty">Keine ankommenden Busse gefunden.</p>
        ${alertsHtml}
      </div>
    `;
  }

  return `
    <div class="stop-popup">
      <h4>${title}</h4>
      <ul>${rows}</ul>
      ${alertsHtml}
    </div>
  `;
}
