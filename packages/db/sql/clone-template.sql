-- Clone template for an app's demo data (platform §6.1). Copy it into the app's migration, replace
-- {{schema}} and {{table}}, and repeat the "copy one table" block for every tenant table, parents before
-- children. A single id_map serves every table, so foreign keys to already-copied rows are remapped with
-- `left join id_map`. Template rows keep relative dates (days_ago, minutes_from_open); the copy gets real
-- timestamps for "today" in Asia/Bangkok, so the demo always looks current.
-- @peera/db's clone test runs this exact file against a test table.

create or replace function {{schema}}.clone_demo_tenant(template uuid, target uuid)
returns void
language plpgsql
as $$
declare
  today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  create temp table id_map (old uuid primary key, new uuid not null) on commit drop;

  -- copy one table: {{table}}
  insert into id_map
    select id, gen_random_uuid() from {{schema}}.{{table}} where tenant_id = template;

  insert into {{schema}}.{{table}} (id, tenant_id, parent_id, name, days_ago, minutes_from_open, occurred_at)
    select m.new, target, p.new, t.name, t.days_ago, t.minutes_from_open,
           ((today - t.days_ago)::timestamp + make_interval(mins => coalesce(t.minutes_from_open, 0)))
             at time zone 'Asia/Bangkok'
    from {{schema}}.{{table}} t
    join id_map m on m.old = t.id
    left join id_map p on p.old = t.parent_id
    where t.tenant_id = template;

  drop table id_map;
end
$$;

-- Children before parents.
create or replace function {{schema}}.delete_demo_tenant(target uuid)
returns void
language sql
as $$
  delete from {{schema}}.{{table}} where tenant_id = target;
$$;
