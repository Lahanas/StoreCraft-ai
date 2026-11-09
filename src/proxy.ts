import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Makes the Clerk session available to server code. Authorization itself is done where the
 * data is accessed (Clerk's recommended resource-based pattern): `/orders` and
 * `/api/checkout` each call `auth()` and reject signed-out users.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals, static files, the Sanity Studio and the Stripe webhook
    // (Stripe calls it without a session; it is authenticated by its signature instead).
    "/((?!_next|studio|api/webhooks|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api(?!/webhooks)|trpc)(.*)",
  ],
};
