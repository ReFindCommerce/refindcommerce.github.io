alter table public.wa_marketing_contacts
  add column if not exists order_count integer not null default 0,
  add column if not exists last_order_at timestamptz,
  add column if not exists device_ecosystem text not null default 'unknown';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'wa_marketing_contacts_device_ecosystem_check'
  ) then
    alter table public.wa_marketing_contacts
      add constraint wa_marketing_contacts_device_ecosystem_check
      check (device_ecosystem in ('unknown', 'apple', 'samsung'));
  end if;
end
$$;

alter table public.wa_marketing_campaigns
  add column if not exists audience_segment text not null default 'broad_opted_in',
  add column if not exists daily_send_limit integer not null default 5;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'wa_marketing_campaigns_audience_segment_check'
  ) then
    alter table public.wa_marketing_campaigns
      add constraint wa_marketing_campaigns_audience_segment_check
      check (audience_segment in (
        'broad_opted_in',
        'prospects_no_purchase',
        'existing_owners',
        'apple_prospects',
        'samsung_prospects',
        'resolved_contacts'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'wa_marketing_campaigns_daily_send_limit_check'
  ) then
    alter table public.wa_marketing_campaigns
      add constraint wa_marketing_campaigns_daily_send_limit_check
      check (daily_send_limit between 1 and 25);
  end if;
end
$$;

insert into public.wa_marketing_settings (key, value) values
  ('daily_send_limit', '5'::jsonb),
  ('max_messages_30d', '1'::jsonb),
  ('send_window_start_hour_london', '10'::jsonb),
  ('send_window_end_hour_london', '18'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

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
    and case campaign.audience_segment
      when 'prospects_no_purchase' then c.order_count = 0
      when 'existing_owners' then c.order_count > 0
      when 'apple_prospects' then c.order_count = 0 and c.device_ecosystem = 'apple'
      when 'samsung_prospects' then c.order_count = 0 and c.device_ecosystem = 'samsung'
      when 'resolved_contacts' then c.support_status = 'satisfied'
      else true
    end
  order by md5(c.phone_e164 || campaign.id::text)
  limit least(campaign.cohort_size, campaign.daily_send_limit)
  on conflict on constraint wa_marketing_recipients_campaign_id_phone_e164_key do nothing;

  return query
  select r.id, r.phone_e164, r.blocked_reasons
  from public.wa_marketing_recipients r
  where r.campaign_id = campaign.id
  order by r.selected_at, r.id;
end;
$$;
