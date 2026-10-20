begin;
alter table public.help_requests drop constraint help_requests_status_check;
alter table public.help_requests add constraint help_requests_status_check check(status in ('open','accepted','completed','cancelled','expired'));
alter table public.help_requests add column accepted_helper_id uuid references auth.users(id) deferrable initially deferred,
 add column accepted_offer_id uuid, add column completed_at timestamptz;

create table public.offers (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.help_requests(id) on delete cascade,
 requester_id uuid not null references auth.users(id) on delete cascade,
 helper_id uuid not null references auth.users(id) on delete cascade,
 helper_name text not null check(char_length(btrim(helper_name)) between 1 and 60),
 request_title text not null,
 message text not null check(char_length(btrim(message)) between 5 and 500),
 status text not null default 'pending' check(status in ('pending','accepted','withdrawn','declined','completed','cancelled','expired')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(request_id,helper_id),check(requester_id<>helper_id)
);
create unique index offers_one_accepted_per_request on public.offers(request_id) where status='accepted';
create index offers_helper_history on public.offers(helper_id,created_at desc);
create index offers_requester_history on public.offers(requester_id,request_id);
alter table public.offers enable row level security;
revoke all on public.offers from public,anon,authenticated;
grant select on public.offers to authenticated;
create policy offers_read_participants on public.offers for select to authenticated
 using(helper_id=(select auth.uid()) or requester_id=(select auth.uid()));
alter table public.help_requests add constraint help_requests_accepted_offer_fkey foreign key(accepted_offer_id) references public.offers(id) deferrable initially deferred;
alter table public.help_requests add constraint help_requests_assignment_check check(
 ((accepted_helper_id is null)=(accepted_offer_id is null))
 and (status not in ('accepted','completed') or accepted_helper_id is not null)
 and (status not in ('open','expired') or accepted_helper_id is null)
);
-- Clients edit request text only. All lifecycle changes use guarded server operations.
revoke update(status) on public.help_requests from authenticated;
drop policy requests_read on public.help_requests;
create policy requests_read on public.help_requests for select to authenticated using(
 owner_id=(select auth.uid()) or accepted_helper_id=(select auth.uid())
 or exists(select 1 from public.offers o where o.request_id=help_requests.id and o.helper_id=(select auth.uid()))
 or (status='open' and expires_at>now())
);
create or replace view public.request_feed with(security_invoker=true) as
 select id,owner_id,title,description,category,area_label,latitude,longitude,
 case when status='open' and expires_at<=now() then 'expired' else status end as status,expires_at,created_at,
 accepted_helper_id,accepted_offer_id,completed_at from public.help_requests;
create view public.offer_feed with(security_invoker=true) as
 select o.id,o.request_id,o.requester_id,o.helper_id,o.helper_name,o.request_title,o.message,
 case when o.status='pending' and r.status='open' and r.expires_at<=now() then 'expired' else o.status end as status,
 o.created_at,o.updated_at from public.offers o join public.help_requests r on r.id=o.request_id;
revoke all on public.offer_feed from public,anon,authenticated;
grant select on public.offer_feed to authenticated;

create or replace function private.validate_help_request() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(new.longitude::double precision,new.latitude::double precision),4326)::extensions.geography,extensions.st_setsrid(extensions.st_makepoint(79.83,11.93),4326)::extensions.geography,25000) then raise exception 'This pilot covers Puducherry and nearby areas only.' using errcode='23514'; end if;
 if current_user='authenticated' then
  if tg_op='INSERT' then
   if new.status<>'open' or new.accepted_helper_id is not null or new.accepted_offer_id is not null or new.expires_at<now()+interval '1 hour' or new.expires_at>now()+interval '7 days' then raise exception 'Invalid initial request state or expiry.' using errcode='23514'; end if;
   new.created_at=now();
  else
   if old.status<>'open' or old.expires_at<=now() then raise exception 'This request is no longer open.' using errcode='23514'; end if;
   if new.status is distinct from old.status or new.accepted_helper_id is distinct from old.accepted_helper_id or new.accepted_offer_id is distinct from old.accepted_offer_id or new.completed_at is distinct from old.completed_at then raise exception 'Use a request action to change its state.' using errcode='23514'; end if;
   if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id or new.expires_at is distinct from old.expires_at or new.created_at is distinct from old.created_at then raise exception 'Immutable request fields changed.' using errcode='23514'; end if;
  end if;
 end if;
 return new;
end $$;

-- Privileged operations live in an unexposed schema, pin search_path and validate the caller.
-- Every mutation locks the request before its offers, avoiding inconsistent lock ordering.
create function private.active_offer_actor() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users u where u.id=actor) then raise exception 'Sign in to continue.' using errcode='42501'; end if;
 return actor;
end $$;
create function private.submit_offer(target_request uuid,offer_message text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_offer_actor(); r public.help_requests%rowtype; prior public.offers%rowtype; result uuid; name text;
begin
 select * into r from public.help_requests where id=target_request for update;
 if not found or r.status<>'open' or r.expires_at<=now() then raise exception 'This request is no longer open.' using errcode='23514'; end if;
 if r.owner_id=actor then raise exception 'You cannot offer on your own request.' using errcode='42501'; end if;
 if offer_message is null or char_length(btrim(offer_message)) not between 5 and 500 then raise exception 'Use a message between 5 and 500 characters.' using errcode='22023'; end if;
 select * into prior from public.offers where request_id=r.id and helper_id=actor for update;
 if found and prior.status not in ('pending','withdrawn','declined') then raise exception 'This offer cannot be changed.' using errcode='23514'; end if;
 select p.display_name into name from public.profiles p where p.user_id=actor;
 insert into public.offers(request_id,requester_id,helper_id,helper_name,request_title,message)
 values(r.id,r.owner_id,actor,coalesce(name,'Neighbor'),r.title,btrim(offer_message))
 on conflict(request_id,helper_id) do update set message=excluded.message,helper_name=excluded.helper_name,request_title=excluded.request_title,status='pending',updated_at=now()
 returning id into result;
 return result;
end $$;
create function private.accept_offer(target_offer uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_offer_actor(); rid uuid; r public.help_requests%rowtype; o public.offers%rowtype;
begin
 select request_id into rid from public.offers where id=target_offer;
 select * into r from public.help_requests where id=rid for update;
 if not found then raise exception 'Request unavailable.' using errcode='23514'; end if;
 if r.owner_id<>actor then raise exception 'Only the requester can accept an offer.' using errcode='42501'; end if;
 if r.status='accepted' and r.accepted_offer_id=target_offer then return r.id; end if;
 if r.status<>'open' or r.expires_at<=now() then raise exception 'Another helper was selected or this request is no longer open.' using errcode='23514'; end if;
 select * into o from public.offers where id=target_offer and request_id=r.id for update;
 if not found or o.status<>'pending' then raise exception 'This offer is no longer pending.' using errcode='23514'; end if;
 update public.offers set status='accepted',updated_at=now() where id=o.id;
 update public.offers set status='declined',updated_at=now() where request_id=r.id and id<>o.id and status='pending';
 update public.help_requests set status='accepted',accepted_helper_id=o.helper_id,accepted_offer_id=o.id where id=r.id;
 return r.id;
end $$;
create function private.withdraw_offer(target_offer uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_offer_actor(); rid uuid; r public.help_requests%rowtype; o public.offers%rowtype;
begin
 select request_id into rid from public.offers where id=target_offer;
 select * into r from public.help_requests where id=rid for update;
 if not found then raise exception 'Request unavailable.' using errcode='23514'; end if;
 select * into o from public.offers where id=target_offer for update;
 if o.helper_id<>actor then raise exception 'Only the helper can withdraw this offer.' using errcode='42501'; end if;
 if o.status='withdrawn' then return r.id; end if;
 if o.status='accepted' and r.status='accepted' and r.accepted_offer_id=o.id then
  update public.offers set status='withdrawn',updated_at=now() where id=o.id;
  update public.help_requests set status=case when expires_at>now() then 'open' else 'expired' end,accepted_helper_id=null,accepted_offer_id=null where id=r.id;
 elsif o.status='pending' and r.status='open' and r.expires_at>now() then
  update public.offers set status='withdrawn',updated_at=now() where id=o.id;
 else raise exception 'This offer can no longer be withdrawn.' using errcode='23514'; end if;
 return r.id;
end $$;
create function private.complete_request(target_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_offer_actor(); r public.help_requests%rowtype;
begin
 select * into r from public.help_requests where id=target_request for update;
 if not found then raise exception 'Request unavailable.' using errcode='23514'; end if;
 if r.owner_id<>actor then raise exception 'Only the requester can complete this request.' using errcode='42501'; end if;
 if r.status='completed' then return r.id; end if;
 if r.status<>'accepted' then raise exception 'Accept a helper before completing the request.' using errcode='23514'; end if;
 update public.offers set status='completed',updated_at=now() where id=r.accepted_offer_id;
 update public.help_requests set status='completed',completed_at=now() where id=r.id;
 return r.id;
end $$;
create function private.cancel_request(target_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_offer_actor(); r public.help_requests%rowtype;
begin
 select * into r from public.help_requests where id=target_request for update;
 if not found then raise exception 'Request unavailable.' using errcode='23514'; end if;
 if r.owner_id<>actor then raise exception 'Only the requester can cancel this request.' using errcode='42501'; end if;
 if r.status='cancelled' then return r.id; end if;
 if r.status not in ('open','accepted') or (r.status='open' and r.expires_at<=now()) then raise exception 'This request can no longer be cancelled.' using errcode='23514'; end if;
 update public.offers set status='cancelled',updated_at=now() where request_id=r.id and status in ('pending','accepted');
 update public.help_requests set status='cancelled' where id=r.id;
 return r.id;
end $$;
revoke all on function private.active_offer_actor(),private.submit_offer(uuid,text),private.accept_offer(uuid),private.withdraw_offer(uuid),private.complete_request(uuid),private.cancel_request(uuid) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.submit_offer(uuid,text),private.accept_offer(uuid),private.withdraw_offer(uuid),private.complete_request(uuid),private.cancel_request(uuid) to authenticated;
create function public.submit_offer(target_request uuid,offer_message text) returns uuid language sql security invoker set search_path='' as $$select private.submit_offer(target_request,offer_message)$$;
create function public.accept_offer(target_offer uuid) returns uuid language sql security invoker set search_path='' as $$select private.accept_offer(target_offer)$$;
create function public.withdraw_offer(target_offer uuid) returns uuid language sql security invoker set search_path='' as $$select private.withdraw_offer(target_offer)$$;
create function public.complete_request(target_request uuid) returns uuid language sql security invoker set search_path='' as $$select private.complete_request(target_request)$$;
create function public.cancel_request(target_request uuid) returns uuid language sql security invoker set search_path='' as $$select private.cancel_request(target_request)$$;
revoke all on function public.submit_offer(uuid,text),public.accept_offer(uuid),public.withdraw_offer(uuid),public.complete_request(uuid),public.cancel_request(uuid) from public,anon;
grant execute on function public.submit_offer(uuid,text),public.accept_offer(uuid),public.withdraw_offer(uuid),public.complete_request(uuid),public.cancel_request(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
