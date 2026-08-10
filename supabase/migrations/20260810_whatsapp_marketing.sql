create extension if not exists pgcrypto;

create table if not exists public.wa_marketing_contacts (
  phone_e164 text primary key check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  preference_token uuid not null default gen_random_uuid() unique,
  shopify_customer_id text unique,
  first_name text,
  last_name text,
  locale text,
  country_code text,
  consent_state text not null default 'NEVER_SUBSCRIBED'
    check (consent_state in ('NEVER_SUBSCRIBED', 'PENDING', 'SUBSCRIBED', 'UNSUBSCRIBED', 'REDACTED')),
  consent_updated_at timestamptz,
  consent_collected_from text,
  consent_basis text not null default 'none'
    check (consent_basis in ('none', 'shopify_whatsapp', 'shopify_sms', 'support_marketing_optin')),
  sms_marketing_state text,
  sms_marketing_updated_at timestamptz,
  sms_marketing_collected_from text,
  source text not null default 'shopify',
  support_status text not null default 'no_history'
    check (support_status in ('no_history', 'satisfied', 'open', 'unsatisfied', 'unknown')),
  support_evidence text,
  last_support_at timestamptz,
  cooling_until timestamptz,
  opted_out_at timestamptz,
  tags jsonb not null default '[]'::jsonb,
  last_shopify_sync_at timestamptz,
  last_inbox_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wa_marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  campaign_kind text not null default 'useful_story'
    check (campaign_kind in ('useful_story', 'private_offer', 'free_gift')),
  template_name text not null,
  template_language text not null default 'en_GB',
  template_components jsonb not null default '[]'::jsonb,
  message_preview text not null,
  button_label text,
  button_url text,
  featured_product_id text,
  featured_product_handle text,
  featured_product_title text,
  scheduled_for timestamptz,
  timezone text not null default 'Europe/London',
  cohort_size integer not null default 25 check (cohort_size between 1 and 100),
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'scheduled', 'running', 'paused', 'completed', 'blocked', 'failed')),
  automatic boolean not null default false,
  approved_at timestamptz,
  approved_by text,
  blocked_reason text,
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wa_marketing_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.wa_marketing_campaigns(id) on delete cascade,
  phone_e164 text not null references public.wa_marketing_contacts(phone_e164),
  shopify_customer_id text,
  eligibility_status text not null default 'queued'
    check (eligibility_status in ('queued', 'eligible', 'blocked')),
  blocked_reasons text[] not null default '{}',
  selected_at timestamptz not null default now(),
  send_status text not null default 'queued'
    check (send_status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  clicked_at timestamptz,
  attributed_order_id text,
  error_code text,
  error_message text,
  updated_at timestamptz not null default now(),
  unique (campaign_id, phone_e164)
);

create index if not exists wa_marketing_recipients_phone_sent_idx
  on public.wa_marketing_recipients (phone_e164, sent_at desc);

create index if not exists wa_marketing_campaigns_schedule_idx
  on public.wa_marketing_campaigns (status, scheduled_for);

alter table public.wa_marketing_campaigns
  add column if not exists template_components jsonb not null default '[]'::jsonb;

alter table public.wa_marketing_contacts
  add column if not exists preference_token uuid not null default gen_random_uuid(),
  add column if not exists consent_basis text not null default 'none',
  add column if not exists sms_marketing_state text,
  add column if not exists sms_marketing_updated_at timestamptz,
  add column if not exists sms_marketing_collected_from text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'wa_marketing_contacts_consent_basis_check'
  ) then
    alter table public.wa_marketing_contacts
      add constraint wa_marketing_contacts_consent_basis_check
      check (consent_basis in ('none', 'shopify_whatsapp', 'shopify_sms', 'support_marketing_optin'));
  end if;
end
$$;

create unique index if not exists wa_marketing_contacts_preference_token_idx
  on public.wa_marketing_contacts (preference_token);

create table if not exists public.wa_marketing_suppressions (
  phone_e164 text primary key check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  reason text not null,
  source text not null default 'whatsapp',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wa_marketing_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.wa_marketing_campaigns(id) on delete set null,
  recipient_id uuid references public.wa_marketing_recipients(id) on delete set null,
  phone_e164 text,
  provider_message_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.wa_marketing_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.wa_marketing_settings (key, value) values
  ('automation_enabled', 'false'::jsonb),
  ('dry_run', 'true'::jsonb),
  ('send_endpoint_armed', 'false'::jsonb),
  ('shopify_connected', 'false'::jsonb),
  ('whatsapp_connected', 'true'::jsonb),
  ('meta_templates_approved', 'false'::jsonb),
  ('max_messages_30d', '2'::jsonb),
  ('support_cooling_days', '7'::jsonb),
  ('default_cohort_size', '25'::jsonb)
on conflict (key) do nothing;

update public.wa_marketing_settings
set value = 'true'::jsonb, updated_at = now()
where key = 'meta_templates_approved';

insert into public.wa_marketing_campaigns (
  name,
  campaign_kind,
  template_name,
  template_language,
  template_components,
  message_preview,
  button_label,
  button_url,
  featured_product_handle,
  featured_product_title,
  cohort_size,
  status,
  automatic
)
select
  'easyTag WhatsApp Pilot 01',
  'useful_story',
  'easytag_travel_story_v1',
  'en_GB',
  '[
    {"type":"button","sub_type":"url","index":"0","parameters":[{"type":"text","text":"products/easytag-apple-wallet-tracker"}]},
    {"type":"button","sub_type":"url","index":"1","parameters":[{"type":"text","text":"__PREFERENCE_TOKEN__"}]}
  ]'::jsonb,
  'That horrible half-second when your wallet is not where you left it. Most of the time it is nearby. The panic does not know that.',
  'See the card',
  'https://easytag.app/products/easytag-apple-wallet-tracker',
  'easytag-apple-wallet-tracker',
  'Apple Card Tracker',
  25,
  'draft',
  false
where not exists (
  select 1 from public.wa_marketing_campaigns where name = 'easyTag WhatsApp Pilot 01'
);

create or replace function public.wa_marketing_setting_number(p_key text, p_default numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value #>> '{}')::numeric from public.wa_marketing_settings where key = p_key), p_default)
$$;

create or replace function public.wa_marketing_block_reasons(
  p_phone_e164 text,
  p_now timestamptz default now()
)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  contact public.wa_marketing_contacts%rowtype;
  reasons text[] := '{}';
  cooling_days integer := public.wa_marketing_setting_number('support_cooling_days', 7)::integer;
  max_messages integer := public.wa_marketing_setting_number('max_messages_30d', 2)::integer;
  recent_sends integer := 0;
begin
  select * into contact from public.wa_marketing_contacts where phone_e164 = p_phone_e164;

  if not found then
    return array['contact_missing'];
  end if;

  if contact.consent_state <> 'SUBSCRIBED' then
    reasons := array_append(reasons, 'whatsapp_consent_not_subscribed');
  end if;

  if contact.opted_out_at is not null or exists (
    select 1 from public.wa_marketing_suppressions s where s.phone_e164 = contact.phone_e164
  ) then
    reasons := array_append(reasons, 'suppressed_or_opted_out');
  end if;

  if contact.support_status in ('open', 'unsatisfied', 'unknown') then
    reasons := array_append(reasons, 'support_not_safely_resolved');
  end if;

  if contact.cooling_until is not null and contact.cooling_until > p_now then
    reasons := array_append(reasons, 'support_cooling_period');
  elsif contact.last_support_at is not null
    and contact.last_support_at > p_now - make_interval(days => cooling_days) then
    reasons := array_append(reasons, 'support_cooling_period');
  end if;

  select count(*) into recent_sends
  from public.wa_marketing_recipients r
  where r.phone_e164 = contact.phone_e164
    and r.send_status in ('sent', 'delivered', 'read')
    and r.sent_at >= p_now - interval '30 days';

  if recent_sends >= max_messages then
    reasons := array_append(reasons, 'rolling_30_day_cap');
  end if;

  return reasons;
end;
$$;

create or replace function public.wa_marketing_select_recipients(p_campaign_id uuid)
returns table (recipient_id uuid, phone_e164 text, blocked_reasons text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign public.wa_marketing_campaigns%rowtype;
begin
  select * into campaign from public.wa_marketing_campaigns where id = p_campaign_id for update;
  if not found then raise exception 'Campaign not found'; end if;
  if campaign.status not in ('approved', 'scheduled') then
    raise exception 'Campaign must be approved or scheduled before cohort selection';
  end if;

  insert into public.wa_marketing_recipients (
    campaign_id,
    phone_e164,
    shopify_customer_id,
    eligibility_status,
    blocked_reasons,
    send_status
  )
  select
    campaign.id,
    c.phone_e164,
    c.shopify_customer_id,
    'eligible',
    '{}',
    'queued'
  from public.wa_marketing_contacts c
  where cardinality(public.wa_marketing_block_reasons(c.phone_e164, now())) = 0
  order by md5(c.phone_e164 || campaign.id::text)
  limit campaign.cohort_size
  on conflict (campaign_id, phone_e164) do nothing;

  return query
  select r.id, r.phone_e164, r.blocked_reasons
  from public.wa_marketing_recipients r
  where r.campaign_id = campaign.id
  order by r.selected_at, r.id;
end;
$$;

create or replace function public.get_wa_marketing_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with contact_health as (
    select
      count(*) filter (where cardinality(public.wa_marketing_block_reasons(c.phone_e164, now())) = 0) as eligible_now,
      count(*) filter (where 'support_cooling_period' = any(public.wa_marketing_block_reasons(c.phone_e164, now()))) as cooling_period,
      count(*) filter (where 'suppressed_or_opted_out' = any(public.wa_marketing_block_reasons(c.phone_e164, now()))) as suppressed,
      count(*) filter (where 'rolling_30_day_cap' = any(public.wa_marketing_block_reasons(c.phone_e164, now()))) as at_30_day_cap
    from public.wa_marketing_contacts c
  ), next_campaign as (
    select to_jsonb(c) - 'eligibility_snapshot' as campaign
    from public.wa_marketing_campaigns c
    where c.status in ('approved', 'scheduled', 'running')
    order by c.scheduled_for nulls last, c.created_at
    limit 1
  ), settings as (
    select jsonb_object_agg(key, value) as values from public.wa_marketing_settings
  )
  select jsonb_build_object(
    'audience', jsonb_build_object(
      'eligibleNow', coalesce(h.eligible_now, 0),
      'coolingPeriod', coalesce(h.cooling_period, 0),
      'suppressed', coalesce(h.suppressed, 0),
      'at30DayCap', coalesce(h.at_30_day_cap, 0)
    ),
    'nextCampaign', n.campaign,
    'settings', coalesce(s.values, '{}'::jsonb),
    'updatedAt', now()
  )
  from contact_health h
  cross join settings s
  left join next_campaign n on true
$$;

create or replace function public.get_wa_marketing_campaigns()
returns table (
  id uuid,
  name text,
  campaign_kind text,
  template_name text,
  template_language text,
  message_preview text,
  button_label text,
  button_url text,
  featured_product_title text,
  scheduled_for timestamptz,
  timezone text,
  cohort_size integer,
  status text,
  automatic boolean,
  approved_at timestamptz,
  blocked_reason text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.name, c.campaign_kind, c.template_name, c.template_language,
    c.message_preview, c.button_label, c.button_url, c.featured_product_title,
    c.scheduled_for, c.timezone, c.cohort_size, c.status, c.automatic,
    c.approved_at, c.blocked_reason, c.created_at, c.updated_at
  from public.wa_marketing_campaigns c
  order by c.created_at desc
  limit 50
$$;

create or replace function public.get_wa_marketing_preference(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.phone_e164 is null then jsonb_build_object('valid', false, 'optedOut', false)
    else jsonb_build_object(
      'valid', true,
      'optedOut', c.opted_out_at is not null or exists (
        select 1 from public.wa_marketing_suppressions s where s.phone_e164 = c.phone_e164
      )
    )
  end
  from (select 1) seed
  left join public.wa_marketing_contacts c on c.preference_token = p_token
$$;

create or replace function public.wa_marketing_opt_out(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  contact_phone text;
begin
  select phone_e164 into contact_phone
  from public.wa_marketing_contacts
  where preference_token = p_token
  for update;

  if contact_phone is null then
    return jsonb_build_object('success', false, 'reason', 'invalid_token');
  end if;

  insert into public.wa_marketing_suppressions (phone_e164, reason, source, created_at, updated_at)
  values (contact_phone, 'Customer opted out on the WhatsApp preferences page', 'preference_page', now(), now())
  on conflict (phone_e164) do update
    set reason = excluded.reason, source = excluded.source, updated_at = now();

  update public.wa_marketing_contacts
  set opted_out_at = coalesce(opted_out_at, now()), consent_state = 'UNSUBSCRIBED', updated_at = now()
  where phone_e164 = contact_phone;

  insert into public.wa_marketing_events (phone_e164, event_type, payload, occurred_at)
  values (contact_phone, 'preference_page_optout', '{}'::jsonb, now());

  return jsonb_build_object('success', true);
end;
$$;

alter table public.wa_marketing_contacts enable row level security;
alter table public.wa_marketing_campaigns enable row level security;
alter table public.wa_marketing_recipients enable row level security;
alter table public.wa_marketing_suppressions enable row level security;
alter table public.wa_marketing_events enable row level security;
alter table public.wa_marketing_settings enable row level security;

revoke all on public.wa_marketing_contacts from anon, authenticated;
revoke all on public.wa_marketing_campaigns from anon, authenticated;
revoke all on public.wa_marketing_recipients from anon, authenticated;
revoke all on public.wa_marketing_suppressions from anon, authenticated;
revoke all on public.wa_marketing_events from anon, authenticated;
revoke all on public.wa_marketing_settings from anon, authenticated;

grant execute on function public.get_wa_marketing_dashboard() to anon, authenticated;
grant execute on function public.get_wa_marketing_campaigns() to anon, authenticated;
grant execute on function public.get_wa_marketing_preference(uuid) to anon, authenticated;
grant execute on function public.wa_marketing_opt_out(uuid) to anon, authenticated;
