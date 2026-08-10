# easyTag WhatsApp Marketing Automation

## Controller

The existing ReFind Inbox remains the user interface. The `/marketing` section reads campaign state from the isolated WhatsApp marketing tables. n8n runs the scheduled work. Shopify is the contact and consent source of truth. Meta WhatsApp Business Cloud sends only approved templates.

The customer-service workflow is not modified. Every new workflow and table uses the `easyTag WhatsApp Marketing` or `wa_marketing_` prefix.

## Active workflows

| Workflow | Schedule (Europe/London) | Purpose |
| --- | --- | --- |
| Shopify Sync | Daily 03:15 | Refresh Shopify phone consent and customer links |
| Support Safety Sync | Daily 03:45 | Import WhatsApp contacts and classify satisfaction conservatively |
| Shopify Contact Import | Daily 04:10 | Add satisfied support-only contacts to Shopify and record WhatsApp consent |
| Opt-out Sync | Every 15 minutes | Process STOP-style replies and website opt-outs, then update Shopify |
| Scheduler | Every 5 minutes | Recheck every gate and send due approved campaigns |

## Eligibility

A customer is eligible only when all of these are true:

- WhatsApp, Shopify phone-marketing, or recorded support marketing consent exists.
- The customer has not opted out on WhatsApp or the preferences page.
- The latest support state is `satisfied` or `no_history`.
- At least seven days have passed since the latest support contact.
- Fewer than two marketing messages were sent in the previous 30 days.

Unknown, open, negative, or ambiguous support history is blocked. Cohorts are selected deterministically after the rules pass.

## Send locks

The scheduler sends nothing unless every setting is true:

- `automation_enabled`
- `dry_run` is false
- `send_endpoint_armed`
- `shopify_connected`
- `whatsapp_connected`
- `meta_templates_approved`

The recipient is checked again immediately before the API call. A stale `sending` record is recovered after 20 minutes.

## Approved templates

- `easytag_travel_story_v1`
- `easytag_private_offer_v1`
- `easytag_free_travel_gift_v1`

Each template includes a product or offer button and a signed website-preferences button. The public route is `/marketing/preferences?token=...`; phone numbers are never placed in the URL.

## Current release state

- Shopify connection: verified
- WhatsApp sender: verified
- Meta templates: approved
- First pilot: draft, 25 people, Apple Card Tracker
- Automation: disabled
- Dry run: enabled
- Send endpoint: disarmed

The final release requires one internal WhatsApp test recipient. After the received template, links, preferences flow, and Shopify opt-out sync are verified, the three release settings can be armed.

## Rollback

Deactivate the five `easyTag WhatsApp Marketing` workflows in n8n. This immediately stops all sync and send activity without changing the existing Inbox support automation. The isolated tables can remain in place for audit history.
