import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';
let db: PGlite;
const ids = [
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
];
let eid: string;
async function asUser(id: string, sql: string) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${id}';`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync('supabase/tests/bootstrap.sql', 'utf8'));
  for (const name of readdirSync('supabase/migrations')
    .filter((n) => n.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('supabase/migrations/' + name, 'utf8'));
  for (let i = 0; i < ids.length; i++)
    await db.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())', [
      ids[i],
      `student${i}@babson.edu`,
    ]);
  await asUser(
    ids[0],
    `select public.create_activity('{"title":"Coffee together","description":"Meet some new people over coffee.","category":"Social","location":"Reynolds lounge","starts_at":"2099-01-01T18:00:00Z","ends_at":"2099-01-01T19:00:00Z","capacity":2,"cost":0,"expectations":"Everyone welcome","cancellation_policy":"Cancel when plans change"}'::jsonb)`,
  );
  eid = (await db.query<{ id: string }>('select id from events')).rows[0].id;
}, 30000);
afterAll(async () => {
  await db?.close();
});
it('denies anonymous and unverified data access', async () => {
  await db.exec("set role anon; set request.jwt.claim.sub=''");
  expect((await db.query('select * from event_feed')).rows).toHaveLength(0);
  await db.exec('reset role');
  await db.query('update auth.users set email_confirmed_at=null where id=$1', [ids[3]]);
  expect((await asUser(ids[3], 'select * from event_feed')).rows).toHaveLength(0);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1', [ids[3]]);
});
it('prevents role escalation and direct attendance mutation', async () => {
  await expect(asUser(ids[1], "update profiles set role='moderator'")).rejects.toThrow();
  await expect(
    asUser(
      ids[1],
      `insert into attendance(event_id,user_id,status) values ('${eid}','${ids[1]}','joined')`,
    ),
  ).rejects.toThrow();
});
it('enforces last seat, idempotency, FIFO promotion, and private membership', async () => {
  expect((await asUser(ids[1], `select join_activity('${eid}') as status`)).rows[0]).toEqual({
    status: 'joined',
  });
  expect((await asUser(ids[1], `select join_activity('${eid}') as status`)).rows[0]).toEqual({
    status: 'joined',
  });
  expect((await asUser(ids[2], `select join_activity('${eid}') as status`)).rows[0]).toEqual({
    status: 'waitlisted',
  });
  expect((await asUser(ids[3], `select * from attendance`)).rows).toHaveLength(0);
  await asUser(ids[1], `select leave_activity('${eid}')`);
  expect(
    (await asUser(ids[2], `select status from attendance where event_id='${eid}'`)).rows[0],
  ).toEqual({ status: 'joined' });
});
it('rejects unauthorized cancellation and allows reports to hide pending review', async () => {
  await expect(asUser(ids[1], `select cancel_activity('${eid}')`)).rejects.toThrow();
  await asUser(
    ids[1],
    `select report_event('${eid}','safety','Threatening behavior at this activity')`,
  );
  expect((await asUser(ids[2], 'select * from event_feed')).rows).toHaveLength(0);
  expect((await db.query('select * from audit_log')).rows.length).toBeGreaterThan(0);
});
it('deduplicates reminder jobs', async () => {
  await db.query("update events set status='published'");
  await db.query(
    "update occurrences set starts_at=now()+interval '23 hours', ends_at=now()+interval '25 hours'",
  );
  await db.exec('select enqueue_reminders();select enqueue_reminders();');
  const rows = (
    await db.query(
      'select user_id,event_id,kind,count(*) from notifications group by 1,2,3 having count(*)>1',
    )
  ).rows;
  expect(rows).toHaveLength(0);
});

it('keeps screenshot objects private and scoped to their uploader', async () => {
  await asUser(
    ids[1],
    `insert into storage.objects(bucket_id,name) values ('event-submissions','${ids[1]}/poster.webp')`,
  );
  expect((await asUser(ids[2], `select * from storage.objects`)).rows).toHaveLength(0);
  expect((await asUser(ids[1], `select * from storage.objects`)).rows).toHaveLength(1);
  await expect(
    asUser(
      ids[2],
      `insert into storage.objects(bucket_id,name) values ('event-submissions','${ids[1]}/forged.webp')`,
    ),
  ).rejects.toThrow();
});
it('denies student curation and keeps revised source events under review', async () => {
  const source = (
    await db.query<{ id: string }>(
      "insert into sources(name,url,kind) values ('Test source','https://www.babson.edu','ics') returning id",
    )
  ).rows[0].id;
  const payload = {
    title: 'Imported campus meetup',
    description: 'A verified open invitation for students.',
    category: 'Social',
    location: 'Reynolds center',
    starts_at: '2099-05-01T17:00:00Z',
    ends_at: '2099-05-01T18:00:00Z',
    capacity: 10,
    cost: 0,
    expectations: 'Everyone welcome',
    cancellation_policy: 'Check source before traveling',
    source_url: 'https://www.babson.edu',
  };
  const draft = (
    await db.query<{ id: string }>(
      'insert into import_drafts(source_id,external_id,fingerprint,content_hash,payload,raw,confidence) values ($1,$2,$3,$4,$5,$5,.95) returning id',
      [source, 'source-1', 'key', 'version1', payload],
    )
  ).rows[0].id;
  await expect(
    asUser(ids[1], `select review_draft('${draft}','publish','${JSON.stringify(payload)}',null)`),
  ).rejects.toThrow();
  await db.query("update profiles set role='moderator' where id=$1", [ids[3]]);
  await asUser(
    ids[3],
    `select review_draft('${draft}','publish','${JSON.stringify(payload)}',null)`,
  );
  const published = (
    await db.query<{ published_event_id: string }>(
      'select published_event_id from import_drafts where id=$1',
      [draft],
    )
  ).rows[0].published_event_id;
  await asUser(ids[1], `select join_activity('${published}')`);
  const edited = { ...payload, location: 'Olin Hall' };
  const revision = (
    await db.query<{ id: string }>(
      'insert into import_drafts(source_id,external_id,fingerprint,content_hash,payload,raw,confidence) values ($1,$2,$3,$4,$5,$5,.95) returning id',
      [source, 'source-1', 'key', 'version2', edited],
    )
  ).rows[0].id;
  expect(
    (await db.query<{ location: string }>('select location from events where id=$1', [published]))
      .rows[0].location,
  ).toBe('Reynolds center');
  await asUser(
    ids[3],
    `select review_draft('${revision}','publish','${JSON.stringify(edited)}',null)`,
  );
  expect(
    (await db.query<{ location: string }>('select location from events where id=$1', [published]))
      .rows[0].location,
  ).toBe('Olin Hall');
  expect(
    (await db.query("select * from notifications where event_id=$1 and kind='change'", [published]))
      .rows,
  ).toHaveLength(1);
  await asUser(
    ids[3],
    `select review_draft('${revision}','publish','${JSON.stringify(edited)}',null)`,
  );
  expect(
    (await db.query("select * from events where title='Imported campus meetup'")).rows,
  ).toHaveLength(1);
});
it('protects job execution and analytics from ordinary students', async () => {
  await expect(asUser(ids[1], 'select enqueue_reminders()')).rejects.toThrow();
  await expect(asUser(ids[1], 'select claim_deliveries()')).rejects.toThrow();
  await expect(asUser(ids[1], 'select pilot_metrics()')).rejects.toThrow();
});
it('blocks visibility and removes existing attendance in both directions', async () => {
  const input = {
    title: 'A second open hangout',
    description: 'A plan to verify blocking and capacity behavior.',
    category: 'Social',
    location: 'Campus lounge',
    starts_at: '2099-06-01T18:00:00Z',
    ends_at: '2099-06-01T19:00:00Z',
    capacity: 2,
    cost: 0,
    expectations: 'All students welcome',
    cancellation_policy: 'Cancel when plans change',
  };
  const created = await asUser(ids[0], `select create_activity('${JSON.stringify(input)}') as id`);
  const id = (created.rows[0] as { id: string }).id;
  await asUser(ids[1], `select join_activity('${id}')`);
  await asUser(ids[2], `select join_activity('${id}')`);
  await asUser(ids[0], `select block_student('${ids[1]}')`);
  expect((await asUser(ids[1], `select * from event_feed where id='${id}'`)).rows).toHaveLength(0);
  expect(
    (await db.query('select * from attendance where event_id=$1 and user_id=$2', [id, ids[1]]))
      .rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query<{ status: string }>(
        'select status from attendance where event_id=$1 and user_id=$2',
        [id, ids[2]],
      )
    ).rows[0].status,
  ).toBe('joined');
});
it('verifies club managers, links Belong clubs, and shows organisers who is going', async () => {
  await db.query("update profiles set role='moderator' where id=$1", [ids[3]]);
  const source = (
    await db.query<{ id: string }>(
      "insert into sources(name,url,kind) values ('Belong test','https://belong.babson.edu/calendar','html') returning id",
    )
  ).rows[0].id;
  const campus = (
    await db.query<{ id: string }>(
      `insert into events(title,description,category,source_id,location,kind,expectations,cancellation_policy)
       values ('Frisbee pickup game','Throw a disc with the club on the lawn.','Sports & outdoors',$1,'Coleman lawn','campus','All welcome','Check source')
       returning id`,
      [source],
    )
  ).rows[0].id;
  await db.query(
    "insert into occurrences(event_id,starts_at,ends_at,capacity) values ($1,'2099-07-01T18:00:00Z','2099-07-01T20:00:00Z',2)",
    [campus],
  );
  await db.query(
    "insert into import_drafts(source_id,external_id,fingerprint,payload,raw,confidence,status,published_event_id) values ($1,'belong-uid-1','fp','{}','{}',.95,'published',$2)",
    [source, campus],
  );
  await expect(
    asUser(ids[1], `select sync_belong_clubs('[]'::jsonb, array['${source}']::uuid[])`),
  ).rejects.toThrow();
  await db.query(
    `select sync_belong_clubs('[{"club_id":73101,"name":"Babson Ultimate Frisbee","acronym":"BUF","uid":"belong-uid-1"}]'::jsonb, array['${source}']::uuid[])`,
  );
  const feed = await asUser(
    ids[1],
    `select organizer, organizer_is_club, organizer_verified, organizer_id, organizer_category from event_feed where id='${campus}'`,
  );
  const row = feed.rows[0] as {
    organizer: string;
    organizer_verified: boolean;
    organizer_id: string;
    organizer_category: string;
  };
  expect(row.organizer).toBe('Babson Ultimate Frisbee');
  expect(row.organizer_verified).toBe(false);
  expect(row.organizer_category).toBe('club');

  for (const id of [ids[1], ids[2], ids[3]])
    expect((await asUser(id, `select join_activity('${campus}') as s`)).rows[0]).toEqual({
      s: 'joined',
    });
  await expect(asUser(ids[2], `select * from event_attendees('${campus}')`)).rejects.toThrow();

  const earlier = (
    await asUser(
      ids[1],
      `select request_club('${row.organizer_id}', null, 'President', null, null) as id`,
    )
  ).rows[0] as { id: string };
  const request = (
    await asUser(
      ids[2],
      `select request_club('${row.organizer_id}', null, 'VP Communications', null, null) as id`,
    )
  ).rows[0] as { id: string };
  await expect(
    asUser(ids[2], `select review_club_request('${request.id}','approve')`),
  ).rejects.toThrow();
  await asUser(ids[3], `select review_club_request('${request.id}','approve')`);
  await expect(
    asUser(ids[3], `select review_club_request('${earlier.id}','approve')`),
  ).rejects.toThrow(/verified manager/);
  await expect(
    asUser(ids[1], `select request_club('${row.organizer_id}', null, 'President', null, null)`),
  ).rejects.toThrow(/verified manager/);
  expect(
    (await asUser(ids[2], `select * from event_attendees('${campus}')`)).rows,
  ).toHaveLength(3);
  await asUser(ids[2], `select post_announcement('${campus}','Bring water and cleats!')`);

  const hangout = {
    title: 'Club throwing clinic',
    description: 'Learn backhands and forehands with the team.',
    category: 'Sports & outdoors',
    location: 'Coleman lawn',
    starts_at: '2099-07-02T18:00:00Z',
    ends_at: '2099-07-02T19:00:00Z',
    capacity: 20,
    cost: 0,
    expectations: 'All levels welcome',
    cancellation_policy: 'Leave if plans change',
  };
  await expect(
    asUser(
      ids[1],
      `select create_activity('${JSON.stringify({ ...hangout, organizer_id: row.organizer_id })}')`,
    ),
  ).rejects.toThrow();
  const posted = (
    await asUser(
      ids[2],
      `select create_activity('${JSON.stringify({ ...hangout, organizer_id: row.organizer_id })}') as id`,
    )
  ).rows[0] as { id: string };
  const asClub = (
    await asUser(
      ids[1],
      `select organizer, organizer_verified from event_feed where id='${posted.id}'`,
    )
  ).rows[0];
  expect(asClub).toEqual({ organizer: 'Babson Ultimate Frisbee', organizer_verified: true });

  const namedRequest = (
    await asUser(
      ids[2],
      `select request_club(null, 'Named Before Import', 'VP Communications', null, null) as id`,
    )
  ).rows[0] as { id: string };
  const namedOrg = (
    await asUser(ids[3], `select review_club_request('${namedRequest.id}','approve') as org`)
  ).rows[0] as { org: string };
  const campus2 = (
    await db.query<{ id: string }>(
      `insert into events(title,description,category,source_id,location,kind,expectations,cancellation_policy)
       values ('Named club mixer','Meet the club before the import links it.','Social',$1,'Reynolds','campus','All welcome','Check source')
       returning id`,
      [source],
    )
  ).rows[0].id;
  await db.query(
    "insert into occurrences(event_id,starts_at,ends_at,capacity) values ($1,'2099-07-03T18:00:00Z','2099-07-03T20:00:00Z',20)",
    [campus2],
  );
  await db.query(
    "insert into import_drafts(source_id,external_id,fingerprint,payload,raw,confidence,status,published_event_id) values ($1,'belong-uid-2','fp-2','{}','{}',.95,'published',$2)",
    [source, campus2],
  );
  await db.query(
    `select sync_belong_clubs('[{"club_id":88001,"name":"Named Before Import","acronym":"NBI","uid":"belong-uid-2"}]'::jsonb, array['${source}']::uuid[])`,
  );
  const linked = (
    await asUser(
      ids[1],
      `select organizer_id, organizer_verified from event_feed where id='${campus2}'`,
    )
  ).rows[0] as { organizer_id: string; organizer_verified: boolean };
  expect(linked).toEqual({ organizer_id: namedOrg.org, organizer_verified: true });

  await asUser(ids[3], `select revoke_club('${row.organizer_id}')`);
  await expect(asUser(ids[2], `select * from event_attendees('${campus}')`)).rejects.toThrow();
});
it('does not deliver stale reminders after cancellation', async () => {
  await db.query("update events set status='cancelled' where id=$1", [eid]);
  const claimed = await db.query<{ notification_id: string }>('select * from claim_deliveries()');
  const stale = (
    await db.query<{ id: string }>(
      "select id from notifications where event_id=$1 and kind='reminder'",
      [eid],
    )
  ).rows.map((n) => n.id);
  expect(stale.length).toBeGreaterThan(0);
  expect(claimed.rows.filter((n) => stale.includes(n.notification_id))).toHaveLength(0);
});
