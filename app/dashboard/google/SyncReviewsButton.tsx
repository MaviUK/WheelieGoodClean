"use client";

type Props = {
  businessId: string;
};

export default function SyncReviewsButton({ businessId }: Props) {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          const res = await fetch("/api/sync/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessId }),
          });

          const data = await res.json();
          alert(JSON.stringify(data, null, 2));
        } catch (err: any) {
          alert(err?.message ?? "Unknown error");
        }
      }}
      className="mt-4 rounded bg-black px-4 py-2 text-white"
    >
      Sync Reviews
    </button>
  );
}
