-- Call-outcome statuses for jewellery discovery CRM
alter table public.admin_discovered_leads
  drop constraint if exists admin_discovered_leads_status_check;

alter table public.admin_discovered_leads
  add constraint admin_discovered_leads_status_check
  check (status = any (array[
    'new',
    'contacted',
    'callback',
    'no_answer',
    'interested',
    'not_interested',
    'demo',
    'qualified',
    'converted',
    'lost',
    'dismissed'
  ]));
