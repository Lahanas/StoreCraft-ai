# StoreCraft – AI E-Commerce Platform

A full-stack e-commerce store with an AI shopping assistant.

**Stack:** Next.js 16 (App Router, Turbopack) · Sanity CMS · Stripe Checkout · Clerk · Vercel AI SDK · Tailwind CSS v4 · Zustand

## Features

- **Catalog in Sanity CMS**: products, categories and orders, with an embedded Studio at `/studio`. A seed script loads **120 products** across 8 categories.
- **Search, filter, sort and paginate** the catalog with GROQ queries (`/products`).
- **Real-time cart**: Zustand store persisted to `localStorage` and synced live across open tabs; stock-aware quantity limits and a slide-out cart drawer.
- **Stripe Checkout**: the server re-reads prices and stock from Sanity (the client only sends ids and quantities) and uses an idempotency key so double-clicks don't create duplicate sessions.
- **Idempotent webhooks**: each paid Checkout Session becomes exactly one order. The order `_id` is derived from the session id and is created in the same atomic Sanity transaction as the stock decrements, so duplicate or concurrent deliveries can never double-count (see `src/app/api/webhooks/stripe/route.ts`).
- **Clerk auth**: sign in/up, user menu, checkout and order history require a signed-in user (checked in each route).
- **AI shopping assistant** (Vercel AI SDK tool calling, multi-step): `searchProducts`, `getProductDetails`, `getRecommendations`, `listCategories` and `addToCart`. Results render as product cards in the chat, and `addToCart` updates the real cart. The model is aware of the current cart contents, and the assistant is only available to users signed in with Clerk (email or OAuth such as Google/GitHub).

## Project structure

```
src/
  app/
    (store)/            storefront pages: home, products, product detail, orders, checkout success, sign-in/up
    api/chat/           AI assistant endpoint (streamText + tools)
    api/checkout/       creates Stripe Checkout Sessions
    api/webhooks/stripe/  verifies signatures, writes orders idempotently
    studio/             embedded Sanity Studio
  components/           Header, CartDrawer, ChatWidget, ProductCard, …
  lib/                  catalog queries, cart store, Stripe client, AI tools
  sanity/               client, schema types, GROQ queries, image helper
  proxy.ts              Clerk middleware (Next 16 calls middleware "proxy")
scripts/seed.ts         seeds 120 products
sanity.config.ts        Studio config
```

## Setup

Requires Node.js 20.9+.

```bash
npm install
cp .env.example .env.local
```

Then fill in `.env.local`:

### 1. Sanity

1. Create a project at [sanity.io/manage](https://www.sanity.io/manage) (or run `npx sanity init --env .env.local`).
2. Set `NEXT_PUBLIC_SANITY_PROJECT_ID` and `NEXT_PUBLIC_SANITY_DATASET`.
3. Under **API → Tokens**, create a token with **Editor** permissions and set `SANITY_API_WRITE_TOKEN`.
4. Under **API → CORS origins**, add `http://localhost:3000` (with credentials) so the Studio works.
5. Seed the catalog:

   ```bash
   npm run seed        # 120 products; re-running is safe (deterministic ids)
   ```

> Tip: make the dataset **private** in production. Orders contain customer emails; the app reads them with the server token only.

### 2. Clerk

Create an application at [dashboard.clerk.com](https://dashboard.clerk.com) and copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Enable the OAuth providers you want (Google, GitHub, …) under **User & Authentication → SSO connections**.

### 3. Stripe

1. Copy your **test mode** secret key to `STRIPE_SECRET_KEY`.
2. Forward webhooks locally with the [Stripe CLI](https://docs.stripe.com/stripe-cli):

   ```bash
   npm run stripe:listen
   ```

   Copy the `whsec_…` secret it prints into `STRIPE_WEBHOOK_SECRET`.
3. Pay with test card `4242 4242 4242 4242`, any future date and any CVC.

### 4. AI assistant

The assistant uses the [Vercel AI Gateway](https://vercel.com/ai-gateway), so you can switch models without code changes. Set `AI_GATEWAY_API_KEY` and optionally `AI_MODEL` (default `anthropic/claude-sonnet-5.5`). On Vercel, the gateway authenticates automatically with OIDC, so the key is only needed locally.

To call a provider directly instead, install e.g. `@ai-sdk/anthropic` and pass `anthropic("<model>")` as `model` in `src/app/api/chat/route.ts`.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Studio is at [/studio](http://localhost:3000/studio).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm run lint` | ESLint |
| `npm run seed` | Seed Sanity with categories and products (`-- --count=200` for more) |
| `npm run stripe:listen` | Forward Stripe webhooks to localhost |

## Deploying to Vercel

1. Import the repo in Vercel and add every variable from `.env.example` (use live keys for production).
2. Set `NEXT_PUBLIC_SITE_URL` to your production URL.
3. In the Stripe dashboard, add a webhook endpoint at `https://<your-domain>/api/webhooks/stripe` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then set `STRIPE_WEBHOOK_SECRET` to its signing secret.
4. Add your production domain to Sanity CORS origins and to Clerk.

## How the webhook stays idempotent

1. The signature is verified against the raw request body.
2. Only `checkout.session.completed` / `async_payment_succeeded` with `payment_status === "paid"` are fulfilled.
3. The order document id is `order-<checkout session id>`. A quick lookup short-circuits retries.
4. The order is written with `create` (fails if the id exists) **in the same transaction** as the stock `dec` patches. If two deliveries race, one transaction commits and the other fails as a whole with `409`, which is treated as "already processed" and answered with `200`.
5. Any other error returns `500`, so Stripe retries later, which is safe for the same reason.
