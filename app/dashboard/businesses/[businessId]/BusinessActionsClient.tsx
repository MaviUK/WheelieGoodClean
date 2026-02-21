"use client";

import { useState } from "react";

export default function BusinessActionsClient({
  businessId,
  isConnected,
}: {
  businessId: string;
  isConnected: boolean;
}) {
  const [syncing, setSyncing] = useState(false);

  async function syncReviews() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Sync failed");

      alert("Sync started / complete (stub).");
    } catch (e: any) {
      alert(e?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <a
        className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm"
        href={`/api/google/oauth/start?businessId=${encodeURIComponent(businessId)}`}
      >
        Connect Google
      </a>

      <button
        className="inline-flex items-center justify-center rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-50"
        onClick={syncReviews}
        disabled={!isConnected || syncing}
        title={!isConnected ? "Connect Google + select account/location first" : undefined}
      >
        {syncing ? "Syncing…" : "Sync Reviews"}
      </button>
    </div>
  );
}
