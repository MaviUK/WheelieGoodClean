"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setSent(true);
  }

  async function handleGoogleLogin() {
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) setErrorMsg(error.message);
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

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="mt-2 w-full rounded-xl border py-2"
        >
          Continue with Google
        </button>

        {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}
      </form>
    </div>
  );
}
