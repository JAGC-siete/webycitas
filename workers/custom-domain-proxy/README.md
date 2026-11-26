# custom-domain-proxy

Cloudflare Worker that serves one client's site on the client's own domain by proxying to the
Webycitas origin. The domain stays in Cloudflare; Railway needs no custom-domain slot.

It applies the same path rules as the Next middleware (`lib/custom-domain-routing.ts`): `/` shows
the client's page, `www` and `/p/<slug>` go to the root, only the assets and public APIs the page
needs pass through, and everything else is a 404.

## Railway (once per environment)

- `TRUSTED_PROXY_SECRET`: random, 32+ characters. Lets the app trust the visitor IP the Worker
  relays, so rate limits are per visitor and not per Cloudflare IP.
- `CUSTOM_DOMAIN_SITES=villesessence.com=ville-s-essence-ddbc`: canonical, `og:url`, JSON-LD and
  the owner's "Ver mi página" link point to the domain.
- Leave `CUSTOM_DOMAIN_REDIRECT` off. With the Worker in front it would loop
  (Worker asks for `/p/<slug>`, the app redirects to the domain, the Worker asks again).

## Deploy

```bash
npx esbuild workers/custom-domain-proxy/index.ts --bundle --format=esm --platform=neutral --target=es2022 --outfile="$TMPDIR/worker.js"
```

Upload `$TMPDIR/worker.js` as an ES module Worker with the vars in `wrangler.jsonc`, set the
`PROXY_SECRET` secret to the same value as `TRUSTED_PROXY_SECRET`, and attach `villesessence.com`
and `www.villesessence.com` as Worker Custom Domains (Cloudflare creates the DNS records and the
certificate).

Rollback: detach the custom domains. The site keeps working at `/p/<slug>`.
