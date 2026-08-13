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

  -- Manual campaigns only use recipients that were explicitly seeded for testing.
  if campaign.automatic then
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
  end if;

  return query
  select r.id, r.phone_e164, r.blocked_reasons
  from public.wa_marketing_recipients r
  where r.campaign_id = campaign.id
    and r.send_status = 'queued'
  order by r.selected_at, r.id;
end;
$$;
