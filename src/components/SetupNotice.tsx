import { isSanityConfigured } from "@/sanity/env";

/** Shown until Sanity env vars are set, so a fresh clone explains itself instead of rendering empty. */
export function SetupNotice() {
  if (isSanityConfigured) return null;
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <p className="font-semibold">Sanity is not configured yet.</p>
      <p className="mt-1">
        Copy <code>.env.example</code> to <code>.env.local</code>, set your Sanity project id and write
        token, then run <code>npm run seed</code> to load 184 products. See the README for the full setup.
      </p>
    </div>
  );
}
