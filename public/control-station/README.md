# ReFind Control Station Prototype

This is a static, front-end-only prototype for a future control interface over the existing Google Sheet workflow.

It does not connect to Google Sheets, GitHub Actions, Higgsfield, Shopify, or any social channel. All approvals and status changes happen inside local browser storage so the current automation cannot be damaged by trying the interface.

## Open it

Open `index.html` in a browser:

```powershell
Start-Process "D:\Documents\ReFind Social media post automation\prototypes\control-station\index.html"
```

## What it demonstrates

- Weekly posting schedule in UK time.
- Week-by-week schedule navigation.
- Campaign review and approval.
- Campaign cards show asset-type-specific creative briefs and a base caption.
- Channel post review and approval grouped by campaign.
- Creative previews beside channel approvals.
- Live-post URL buttons for already posted channel posts.
- Mock status updates, health checks, posting issues, and audit trail.
- Mobile-friendly layout for iPhone use.

## Future live version

The safest production path is to keep the Google Sheet as the source of truth and make this app a small control layer:

- Read campaign and channel post rows from the Sheet.
- Only write narrow status/approval cells back to the Sheet.
- Trigger existing GitHub Actions workflows rather than replacing the backend.
- Keep duplicate-generation, product-fit, and schedule guardrails in the backend.

Recommended initial hosting: Cloudflare Pages for the static app, then add Cloudflare Workers only when authenticated writes and workflow triggers are connected.
