alter table public.wa_marketing_recipients
  add column if not exists click_token uuid not null default gen_random_uuid(),
  add column if not exists first_clicked_at timestamptz,
  add column if not exists last_clicked_at timestamptz,
  add column if not exists click_count integer not null default 0,
  add column if not exists attributed_order_name text,
  add column if not exists attributed_revenue numeric(12, 2),
  add column if not exists attributed_currency text,
  add column if not exists attributed_at timestamptz;

create unique index if not exists wa_marketing_recipients_click_token_idx
  on public.wa_marketing_recipients (click_token);

create or replace function public.wa_marketing_record_click(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient public.wa_marketing_recipients%rowtype;
  campaign public.wa_marketing_campaigns%rowtype;
  separator text;
  destination text;
begin
  select * into recipient
  from public.wa_marketing_recipients
  where click_token = p_token
    and send_status in ('sent', 'delivered', 'read')
  for update;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  select * into campaign
  from public.wa_marketing_campaigns
  where id = recipient.campaign_id;

  if campaign.button_url is null
    or campaign.button_url !~* '^https://(www\.)?easytag\.app(/|$)' then
    return jsonb_build_object('valid', false);
  end if;

  separator := case when position('?' in campaign.button_url) > 0 then '&' else '?' end;
  destination := campaign.button_url || separator
    || 'utm_source=whatsapp&utm_medium=marketing&utm_campaign=' || campaign.id::text
    || '&utm_content=' || regexp_replace(lower(campaign.template_name), '[^a-z0-9_-]+', '-', 'g')
    || '&wa_recipient=' || recipient.click_token::text;

  update public.wa_marketing_recipients
  set clicked_at = coalesce(clicked_at, now()),
      first_clicked_at = coalesce(first_clicked_at, now()),
      last_clicked_at = now(),
      click_count = click_count + 1,
      updated_at = now()
  where id = recipient.id;

  insert into public.wa_marketing_events (
    campaign_id, recipient_id, phone_e164, provider_message_id,
    event_type, payload, occurred_at
  ) values (
    recipient.campaign_id, recipient.id, recipient.phone_e164, recipient.provider_message_id,
    'click', jsonb_build_object('destination', destination), now()
  );

  return jsonb_build_object('valid', true, 'destination', destination);
end;
$$;

revoke all on function public.wa_marketing_record_click(uuid) from public;
grant execute on function public.wa_marketing_record_click(uuid) to anon, authenticated;

create or replace function public.wa_marketing_attribute_order(
  p_shopify_customer_id text,
  p_order_id text,
  p_order_name text,
  p_order_created_at timestamptz,
  p_revenue numeric,
  p_currency text,
  p_landing_site text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
  landing_token uuid;
  customer_numeric_id text;
begin
  if p_order_id is null or p_order_created_at is null then
    return jsonb_build_object('attributed', false, 'reason', 'invalid_order');
  end if;

  begin
    landing_token := substring(coalesce(p_landing_site, '') from 'wa_recipient=([0-9a-fA-F-]{36})')::uuid;
  exception when others then
    landing_token := null;
  end;

  if landing_token is not null then
    select r.id into recipient_id
    from public.wa_marketing_recipients r
    where r.click_token = landing_token
      and r.first_clicked_at is not null
      and r.first_clicked_at <= p_order_created_at
      and r.first_clicked_at >= p_order_created_at - interval '30 days'
      and r.attributed_order_id is null
    limit 1;
  end if;

  if recipient_id is null and p_shopify_customer_id is not null then
    customer_numeric_id := substring(p_shopify_customer_id from '([0-9]+)$');

    select r.id into recipient_id
    from public.wa_marketing_recipients r
    where r.first_clicked_at is not null
      and r.first_clicked_at <= p_order_created_at
      and r.first_clicked_at >= p_order_created_at - interval '30 days'
      and r.attributed_order_id is null
      and (
        r.shopify_customer_id = p_shopify_customer_id
        or substring(r.shopify_customer_id from '([0-9]+)$') = customer_numeric_id
      )
    order by r.first_clicked_at desc
    limit 1;
  end if;

  if recipient_id is null then
    return jsonb_build_object('attributed', false, 'reason', 'no_recent_marketing_click');
  end if;

  update public.wa_marketing_recipients
  set attributed_order_id = p_order_id,
      attributed_order_name = p_order_name,
      attributed_revenue = p_revenue,
      attributed_currency = upper(p_currency),
      attributed_at = now(),
      updated_at = now()
  where id = recipient_id;

  insert into public.wa_marketing_events (
    campaign_id, recipient_id, phone_e164, provider_message_id,
    event_type, payload, occurred_at
  )
  select r.campaign_id, r.id, r.phone_e164, r.provider_message_id,
    'order_attributed',
    jsonb_build_object(
      'orderId', p_order_id,
      'orderName', p_order_name,
      'revenue', p_revenue,
      'currency', upper(p_currency),
      'orderCreatedAt', p_order_created_at
    ),
    now()
  from public.wa_marketing_recipients r
  where r.id = recipient_id;

  return jsonb_build_object('attributed', true, 'recipientId', recipient_id);
end;
$$;

revoke all on function public.wa_marketing_attribute_order(text, text, text, timestamptz, numeric, text, text) from public, anon, authenticated;

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
  ), results as (
    select
      count(*) filter (where send_status in ('delivered', 'read')) as delivered,
      count(*) filter (where first_clicked_at is not null) as clicked,
      count(*) filter (where attributed_order_id is not null) as orders,
      coalesce(sum(attributed_revenue) filter (where attributed_order_id is not null), 0) as revenue
    from public.wa_marketing_recipients
  )
  select jsonb_build_object(
    'audience', jsonb_build_object(
      'eligibleNow', coalesce(h.eligible_now, 0),
      'coolingPeriod', coalesce(h.cooling_period, 0),
      'suppressed', coalesce(h.suppressed, 0),
      'at30DayCap', coalesce(h.at_30_day_cap, 0)
    ),
    'results', jsonb_build_object(
      'delivered', coalesce(r.delivered, 0),
      'clicked', coalesce(r.clicked, 0),
      'orders', coalesce(r.orders, 0),
      'ctr', case when r.delivered > 0 then round((r.clicked::numeric / r.delivered::numeric) * 100, 2) else 0 end,
      'conversionRate', case when r.clicked > 0 then round((r.orders::numeric / r.clicked::numeric) * 100, 2) else 0 end,
      'revenue', coalesce(r.revenue, 0)
    ),
    'nextCampaign', n.campaign,
    'settings', coalesce(s.values, '{}'::jsonb),
    'updatedAt', now()
  )
  from contact_health h
  cross join settings s
  cross join results r
  left join next_campaign n on true
$$;

drop function if exists public.get_wa_marketing_campaigns();

create function public.get_wa_marketing_campaigns()
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
  delivered bigint,
  clicked bigint,
  orders bigint,
  ctr numeric,
  conversion_rate numeric,
  revenue numeric,
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
    c.approved_at, c.blocked_reason,
    count(r.id) filter (where r.send_status in ('delivered', 'read')) as delivered,
    count(r.id) filter (where r.first_clicked_at is not null) as clicked,
    count(r.id) filter (where r.attributed_order_id is not null) as orders,
    case when count(r.id) filter (where r.send_status in ('delivered', 'read')) > 0
      then round(((count(r.id) filter (where r.first_clicked_at is not null))::numeric
        / (count(r.id) filter (where r.send_status in ('delivered', 'read')))::numeric) * 100, 2)
      else 0 end as ctr,
    case when count(r.id) filter (where r.first_clicked_at is not null) > 0
      then round(((count(r.id) filter (where r.attributed_order_id is not null))::numeric
        / (count(r.id) filter (where r.first_clicked_at is not null))::numeric) * 100, 2)
      else 0 end as conversion_rate,
    coalesce(sum(r.attributed_revenue) filter (where r.attributed_order_id is not null), 0) as revenue,
    c.created_at, c.updated_at
  from public.wa_marketing_campaigns c
  left join public.wa_marketing_recipients r on r.campaign_id = c.id
  group by c.id
  order by c.created_at desc
  limit 50
$$;

grant execute on function public.get_wa_marketing_campaigns() to anon, authenticated;

insert into public.wa_marketing_settings (key, value) values
  ('click_tracking_connected', 'false'::jsonb),
  ('order_attribution_connected', 'false'::jsonb)
on conflict (key) do nothing;
