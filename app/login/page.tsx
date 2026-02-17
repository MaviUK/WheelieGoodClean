"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback",
      },
    });

    if (!error) setSent(true);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          Check your email for a login link.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold">Sign in</h1>

        <input
          type="email"
          required
          placeholder="you@company.com"
          className="mt-4 w-full rounded-xl border px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button className="mt-4 w-full rounded-xl bg-black py-2 text-white">
          Send magic link
        </button>
      </form>
    </div>
  );
}
