"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Account = { name: string; displayName: string };
type Location = { name: string; title: string; address: string | null };

export default function GooglePickerClient({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [accountName, setAccountName] = useState<string>("");
  const [locationName, setLocationName] = useState<string>("");

  const canSave = useMemo(() => !!accountName && !!locationName, [accountName, locationName]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/google/gbp/accounts?businessId=${encodeURIComponent(businessId)}`);
        const json = await res.json();
        setAccounts(json.accounts ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [businessId]);

  useEffect(() => {
    if (!accountName) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/google/gbp/locations?businessId=${encodeURIComponent(businessId)}&accountName=${encodeURIComponent(accountName)}`
        );
        const json = await res.json();
        setLocations(json.locations ?? []);
        setLocationName("");
      } finally {
        setLoading(false);
      }
    })();
  }, [businessId, accountName]);

  async function save() {
    if (!canSave) return;
    setLoading(true);
    try {
      const res = await fetch("/api/google/gbp/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          googleAccountName: accountName,
          googleLocationName: locationName,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to save selection");

      router.refresh();
      alert("Saved Google account + location.");
    } catch (e: any) {
      alert(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="font-medium">Choose Google account + location</div>

      <div className="grid gap-2">
        <label className="text-sm">Account</label>
        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          disabled={loading}
        >
          <option value="">Select an account…</option>
          {accounts.map((a) => (
            <option key={a.name} value={a.name}>
              {a.displayName} ({a.name})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-sm">Location</label>
        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          disabled={!accountName || loading}
        >
          <option value="">Select a location…</option>
          {locations.map((l) => (
            <option key={l.name} value={l.name}>
              {l.title} {l.address ? `— ${l.address}` : ""}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={save}
        disabled={!canSave || loading}
        className="rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-50"
      >
        {loading ? "Working…" : "Save selection"}
      </button>
    </div>
  );
}
