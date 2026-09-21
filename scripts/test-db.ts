import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
// This test creates and removes its own database. Supply TEST_DATABASE_URL for CI.
const url = process.env.TEST_DATABASE_URL || 'postgresql://common_test@127.0.0.1:55439/postgres';
const base = new URL(url);
if (!['localhost', '127.0.0.1'].includes(base.hostname))
  throw new Error('Database tests only run on localhost');
const root = new pg.Client({ connectionString: url });
await root.connect();
const database = 'common_test_' + Date.now();
await root.query(`create database ${database}`);
base.pathname = '/' + database;
const admin = new pg.Client({ connectionString: base.toString() });
await admin.connect();
const clients: pg.Client[] = [];
try {
  // Roles are cluster-level: isolated local instance only. Reuse existing test roles on repeat runs.
  for (const role of ['anon', 'authenticated', 'service_role']) {
    if (!(await root.query('select 1 from pg_roles where rolname=$1', [role])).rowCount)
      await root.query(`create role ${role} nologin ${role === 'service_role' ? 'bypassrls' : ''}`);
  }
  const bootstrap = (await readFile('supabase/tests/bootstrap.sql', 'utf8')).replace(
    /^create role .*;\n/gm,
    '',
  );
  await admin.query(bootstrap);
  for (const name of (await readdir('supabase/migrations'))
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    await admin.query(await readFile('supabase/migrations/' + name, 'utf8'));
  }
  const users = Array.from({ length: 12 }, () => randomUUID());
  for (let i = 0; i < users.length; i++) {
    await admin.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())', [
      users[i],
      `race${i}@babson.edu`,
    ]);
    const c = new pg.Client({ connectionString: base.toString() });
    await c.connect();
    await c.query('set role authenticated');
    await c.query("select set_config('request.jwt.claim.sub',$1,false)", [users[i]]);
    clients.push(c);
  }
  const activity = {
    title: 'Concurrent coffee',
    description: 'An open coffee hangout to test the last seat.',
    category: 'Social',
    location: 'Reynolds lounge',
    starts_at: '2099-01-01T18:00:00Z',
    ends_at: '2099-01-01T19:00:00Z',
    capacity: 2,
    cost: 0,
    expectations: 'Everyone welcome',
    cancellation_policy: 'Cancel when plans change',
  };
  const eid = (await clients[0].query('select create_activity($1) as id', [activity])).rows[0].id;
  const results = await Promise.all(
    clients.slice(1).map((c) => c.query('select join_activity($1) as status', [eid])),
  );
  assert.equal(
    results.filter((r) => r.rows[0].status === 'joined').length,
    1,
    'exactly one concurrent caller wins the last seat',
  );
  assert.equal(results.filter((r) => r.rows[0].status === 'waitlisted').length, 10);
  assert.equal(
    (
      await admin.query(
        "select count(*)::int as n from attendance where event_id=$1 and status='joined'",
        [eid],
      )
    ).rows[0].n,
    2,
  );
  const firstWaiting = (
    await admin.query(
      "select user_id from attendance where event_id=$1 and status='waitlisted' order by queued_at,user_id limit 1",
      [eid],
    )
  ).rows[0].user_id;
  const winner = results.findIndex((r) => r.rows[0].status === 'joined') + 1;
  await clients[winner].query('select leave_activity($1)', [eid]);
  assert.equal(
    (
      await admin.query('select status from attendance where event_id=$1 and user_id=$2', [
        eid,
        firstWaiting,
      ])
    ).rows[0].status,
    'joined',
  );
  const rejected = await Promise.allSettled(
    clients.slice(1).map((c) => c.query("update profiles set role='moderator'")),
  );
  assert.ok(rejected.every((r) => r.status === 'rejected'));
  console.log(
    'PASS: 11 simultaneous last-seat claims, exact capacity, FIFO promotion, and role escalation denial.',
  );
} finally {
  await Promise.all(clients.map((c) => c.end()));
  await admin.end();
  await root.query(`drop database ${database} with (force)`);
  await root.end();
}
