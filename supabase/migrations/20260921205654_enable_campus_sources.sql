-- Applied on the hosted project. Sources are enabled and allowed to auto-publish.
insert into public.sources(id,name,url,kind,enabled,auto_publish,default_category,default_capacity) values
('20000000-0000-0000-0000-000000000001','Babson Undergraduate Student Engagement','https://www.babson.edu/office-of-undergraduate-student-engagement/undergraduate-events/','html',true,true,'Social',60),
('20000000-0000-0000-0000-000000000002','Babson Belong Calendar','https://belong.babson.edu/calendar','html',true,true,'Social',60),
('20000000-0000-0000-0000-000000000003','Babson Campus Events','https://www.babson.edu/about/events/','html',true,true,'Learning',80),
('20000000-0000-0000-0000-000000000004','Babson Athletics','https://babsonathletics.com/calendar','html',true,true,'Sports & outdoors',100),
('20000000-0000-0000-0000-000000000005','Babson CampusGroups (club events)','https://campusgroups.com/ssoLogin.php','ics',true,true,'Social',60)
on conflict(id) do update set
  name=excluded.name,
  url=excluded.url,
  kind=excluded.kind,
  enabled=true,
  auto_publish=true,
  default_category=excluded.default_category,
  default_capacity=excluded.default_capacity;
