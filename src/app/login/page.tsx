"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      redirect: false,
    });

    if (result?.error) {
      setError("Sign in failed");
      setLoading(false);
      return;
    }

    router.push("/chat");
    router.refresh();
  }

  const inputCls =
    "w-full px-4 py-2.5 rounded-2xl border border-border bg-transparent text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass ring-soft rounded-3xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="grad-primary w-14 h-14 rounded-3xl flex items-center justify-center text-white text-xl font-bold shadow-lg mx-auto mb-3">
            K
          </div>
          <h1 className="text-2xl font-bold tracking-tight grad-text">Kiwi</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Enter a username to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className={inputCls}
          />

          {error && (
            <p className="text-destructive text-xs px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="grad-primary w-full text-white font-medium rounded-2xl py-2.5 shadow-md shadow-[oklch(0.15_0_0/0.3)] hover:opacity-95 disabled:opacity-60 transition"
          >
            {loading ? "…" : "Continue"}
          </button>
        </form>

      </div>
    </div>
  );
}
