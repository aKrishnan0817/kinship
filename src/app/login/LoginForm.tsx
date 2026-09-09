"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, {});

  return (
    <form action={action} className="mt-5">
      <input type="hidden" name="next" value={next} />
      <input
        autoFocus
        name="password"
        type="password"
        placeholder="Family password"
        autoComplete="current-password"
        className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-[15px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-3 w-full rounded-md bg-stone-900 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
      >
        {pending ? "Checking…" : "Come in"}
      </button>
      {state?.error && <div className="mt-3 text-[12px] text-rose-600">{state.error}</div>}
    </form>
  );
}
