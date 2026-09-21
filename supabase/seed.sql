-- Real source references only. No fictional events or identities enter the shared database.
-- All new sources ship disabled. A moderator flips enabled + auto_publish after they have
-- 1) confirmed the URL still serves the documented feed and 2) obtained permission from
-- the owner. Auto-published events still write to audit_log and can be reverted through
-- moderate_event.

insert into public.sources(id,name,url,kind,enabled,auto_publish,default_category,default_capacity) values
  ('20000000-0000-0000-0000-000000000001',
   'Babson Undergraduate Student Engagement',
   'https://www.babson.edu/office-of-undergraduate-student-engagement/undergraduate-events/',
   'html', false, false, 'Social', 60),
  ('20000000-0000-0000-0000-000000000002',
   'Babson Belong Calendar',
   'https://belong.babson.edu/calendar',
   'html', false, false, 'Social', 60),
  ('20000000-0000-0000-0000-000000000003',
   'Babson Campus Events',
   'https://www.babson.edu/about/events/',
   'html', false, false, 'Learning', 80),
  ('20000000-0000-0000-0000-000000000004',
   'Babson Athletics',
   'https://babsonathletics.com/calendar',
   'html', false, false, 'Sports & outdoors', 100),
  ('20000000-0000-0000-0000-000000000005',
   'Babson CampusGroups (club events)',
   'https://campusgroups.com/ssoLogin.php',
   'ics', false, false, 'Social', 60)
on conflict(id) do update set
  url = excluded.url,
  kind = excluded.kind,
  default_category = excluded.default_category,
  default_capacity = excluded.default_capacity;
