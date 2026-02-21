"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type BusinessRow = {
  id: string;
  name: string;
  googleAccountName: string | null;
  googleLocationName: string | null;
  googleConnection: {
    id: string;
    updatedAt: Date;
    expiryDate: Date | null;
  } | null;
};

export default function GoogleBusinessChooserClient({
  businesses,
}: {
  businesses: BusinessRow[];
}) {
  const safeBusinesses = Array.isArray(businesses) ? businesses : [];

  const [businessId, setBusinessId] = useState<string>(
    safeBusinesses.length > 0 ? safeBusinesses[0]!.id : ""
  );

  const selected = useMemo(() => {
    if (!businessId) return null;
    return safeBusinesses.find((b) => b.id === businessId) ?? null;
  }, [businessId, safeBusinesses]);

  if (safeBusinesses.length === 0) {
    return (
      <div className="text-sm text-zinc-600">
        You don’t have any businesses yet. Create one in{" "}
        <Link className="underline" href="/dashboard/businesses">
          Businesses
        </Link>
        .
      </div>
    );
  }

  const connected = !!selected?.googleConnection;

  async function disconnect() {
    if (!selected) return;

    const res = await fetch("/api/google/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: selected.id }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) return alert(j?.error ?? "Failed to disconnect");

    window.location.reload();
  }

  async function syncReviews() {
    if (!selected) return;

    const res = await fetch("/api/sync/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: selected.id }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) return alert(j?.error ?? "Sync failed");

    alert("Sync completed.");
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Select business</label>
        <select
          className="mt-2 h-10 w-full rounded-xl border px-3"
          value={businessId}
          onChange={(e) => setBusinessId(e.target.value)}
        >
          {safeBusinesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">
              Status:{" "}
              <span className={connected ? "text-green-600" : "text-zinc-500"}>
                {connected ? "Connected" : "Not connected"}
              </span>
            </div>

            {selected?.googleConnection?.updatedAt ? (
              <div className="mt-1 text-sm text-zinc-500">
                Last updated:{" "}
                {new Date(selected.googleConnection.updatedAt).toLocaleString()}
              </div>
            ) : null}
          </div>

          {!connected ? (
            <Link
              href={`/api/google/oauth/start?businessId=${encodeURIComponent(
                selected?.id ?? ""
              )}`}
              className="rounded-xl bg-black px-4 py-2 text-white"
            >
              Connect Google
            </Link>
          ) : (
            <button onClick={disconnect} className="rounded-xl border px-4 py-2">
              Disconnect
            </button>
          )}
        </div>

        <div className="mt-4 text-sm">
          <div>
            <span className="text-zinc-500">Account: </span>
            <span className="font-mono">{selected?.googleAccountName ?? "—"}</span>
          </div>
          <div>
            <span className="text-zinc-500">Location: </span>
            <span className="font-mono">{selected?.googleLocationName ?? "—"}</span>
          </div>
        </div>

        {connected ? (
          <div className="mt-4">
            <button
              onClick={syncReviews}
              className="rounded-xl bg-black px-4 py-2 text-white"
            >
              Sync Reviews
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}