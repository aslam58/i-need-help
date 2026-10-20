begin;
create extension if not exists postgis with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.help_requests (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 3 and 80),
 description text not null check(char_length(btrim(description)) between 5 and 1000),
 category text not null check(category in ('errands','tools','tech','other')),
 area_label text not null check(char_length(btrim(area_label)) between 3 and 80),
 latitude numeric(5,2) not null check(latitude between -90 and 90),
 longitude numeric(6,2) not null check(longitude between -180 and 180),
 location extensions.geography(Point,4326) generated always as
   (extensions.st_setsrid(extensions.st_makepoint(longitude::double precision,latitude::double precision),4326)::extensions.geography) stored,
 status text not null default 'open' check(status in ('open','cancelled','expired')),
 expires_at timestamptz not null default now()+interval '24 hours',
 created_at timestamptz not null default now()
);
create index help_requests_location_idx on public.help_requests using gist(location);
create index help_requests_owner_idx on public.help_requests(owner_id,created_at desc);
create index help_requests_active_idx on public.help_requests(status,expires_at,category);
alter table public.help_requests enable row level security;
revoke all on public.help_requests from public, anon, authenticated;
grant select on public.help_requests to authenticated;
grant insert(title,description,category,area_label,latitude,longitude,expires_at) on public.help_requests to authenticated;
grant update(title,description,category,status) on public.help_requests to authenticated;
create policy requests_read on public.help_requests for select to authenticated
 using(owner_id=(select auth.uid()) or (status='open' and expires_at>now()));
create policy requests_insert_own on public.help_requests for insert to authenticated
 with check(owner_id=(select auth.uid()));
create policy requests_update_own on public.help_requests for update to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));

create function private.validate_help_request() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(new.longitude::double precision,new.latitude::double precision),4326)::extensions.geography,extensions.st_setsrid(extensions.st_makepoint(79.83,11.93),4326)::extensions.geography,25000) then raise exception 'This pilot covers Puducherry and nearby areas only.' using errcode='23514'; end if;
 if current_user='authenticated' then
  if tg_op='INSERT' then
   if new.status<>'open' or new.expires_at<now()+interval '1 hour' or new.expires_at>now()+interval '7 days' then raise exception 'Invalid initial request state or expiry.' using errcode='23514'; end if;
   new.created_at=now();
  else
   if old.status<>'open' or old.expires_at<=now() then raise exception 'This request is no longer open.' using errcode='23514'; end if;
   if new.status not in ('open','cancelled') then raise exception 'Invalid request transition.' using errcode='23514'; end if;
   if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id or new.expires_at is distinct from old.expires_at or new.created_at is distinct from old.created_at then raise exception 'Immutable request fields changed.' using errcode='23514'; end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_help_request() from public,anon,authenticated;
create trigger validate_help_request before insert or update on public.help_requests for each row execute function private.validate_help_request();

create view public.request_feed with (security_invoker=true) as
 select id,owner_id,title,description,category,area_label,latitude,longitude,
 case when status='open' and expires_at<=now() then 'expired' else status end as status,expires_at,created_at
 from public.help_requests;
revoke all on public.request_feed from public,anon,authenticated;
grant select on public.request_feed to authenticated;

create function public.create_help_request(request_title text,request_description text,request_category text,request_area text,request_lat numeric,request_lon numeric,duration_hours integer default 24)
 returns uuid language plpgsql security invoker set search_path='' as $$
declare request_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to post a request.' using errcode='42501'; end if;
 if duration_hours is null or duration_hours not in (6,24,72) then raise exception 'Invalid request duration.' using errcode='22023'; end if;
 insert into public.help_requests(title,description,category,area_label,latitude,longitude,expires_at)
 values(request_title,request_description,request_category,request_area,request_lat,request_lon,now()+duration_hours*interval '1 hour') returning id into request_id;
 return request_id;
end $$;
revoke all on function public.create_help_request(text,text,text,text,numeric,numeric,integer) from public,anon;
grant execute on function public.create_help_request(text,text,text,text,numeric,numeric,integer) to authenticated;

create function public.nearby_requests(search_lat double precision,search_lon double precision,radius_km integer default 5,filter_category text default null,page_offset integer default 0)
 returns table(id uuid,owner_id uuid,title text,description text,category text,area_label text,status text,expires_at timestamptz,created_at timestamptz,distance_km numeric)
 language plpgsql stable security invoker set search_path='' as $$
declare center extensions.geography;
begin
 if auth.uid() is null then raise exception 'Sign in to browse requests.' using errcode='42501'; end if;
 if search_lat is null or search_lon is null or search_lat not between -90 and 90 or search_lon not between -180 and 180 or radius_km is null or radius_km not between 1 and 25 or page_offset is null or page_offset not between 0 and 10000 then raise exception 'Invalid search area or radius.' using errcode='22023'; end if;
 if filter_category is not null and filter_category not in ('errands','tools','tech','other') then raise exception 'Invalid category.' using errcode='22023'; end if;
 center=extensions.st_setsrid(extensions.st_makepoint(search_lon,search_lat),4326)::extensions.geography;
 return query select r.id,r.owner_id,r.title,r.description,r.category,r.area_label,r.status,r.expires_at,r.created_at,
 round((extensions.st_distance(r.location,center)/1000)::numeric,1)
 from public.help_requests r where r.status='open' and r.expires_at>now()
 and (filter_category is null or r.category=filter_category)
 and extensions.st_dwithin(r.location,center,radius_km*1000)
 order by extensions.st_distance(r.location,center),r.created_at desc,r.id limit 20 offset page_offset;
end $$;
revoke all on function public.nearby_requests(double precision,double precision,integer,text,integer) from public,anon;
grant execute on function public.nearby_requests(double precision,double precision,integer,text,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
