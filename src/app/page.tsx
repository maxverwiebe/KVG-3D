import dynamic from "next/dynamic";

const LiveBusViewer = dynamic(() => import("@/components/live-bus-viewer"), {
  ssr: false
});

export default function HomePage() {
  return (
    <main className="app-root">
      <LiveBusViewer />
    </main>
  );
}
