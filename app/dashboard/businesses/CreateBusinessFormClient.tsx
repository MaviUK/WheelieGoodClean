"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateBusinessFormClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a business name.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to create business");

      setName("");
      router.refresh(); // ✅ this makes the Server Component re-fetch businesses
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Business name"
        className="border rounded-md px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create"}
      </button>

      {error ? <span className="text-xs text-red-600 ml-2">{error}</span> : null}
    </form>
  );
}
