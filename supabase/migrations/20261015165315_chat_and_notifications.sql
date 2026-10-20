begin;
create table public.blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
alter table public.blocks enable row level security;
revoke all on public.blocks from public,anon,authenticated;
grant select,insert,delete on public.blocks to authenticated;
create policy own_blocks on public.blocks for all to authenticated using(blocker_id=(select auth.uid())) with check(blocker_id=(select auth.uid()));
create index blocks_target on public.blocks(blocked_id);
create table public.conversations (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.help_requests(id),
 offer_id uuid not null references public.offers(id), requester_id uuid not null references auth.users(id),
 helper_id uuid not null references auth.users(id), created_at timestamptz not null default now(), closed_at timestamptz
);
create unique index active_conversation on public.conversations(request_id) where closed_at is null;
create index conversations_offer on public.conversations(offer_id);
create index conversations_helper on public.conversations(helper_id);
create index conversations_requester on public.conversations(requester_id);
alter table public.conversations enable row level security;
revoke all on public.conversations from public,anon,authenticated;
grant select on public.conversations to authenticated;
create policy participants on public.conversations for select to authenticated using((select auth.uid()) in (requester_id,helper_id));
create table public.messages (
 id uuid primary key, conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id), body text not null check(char_length(btrim(body)) between 1 and 2000), created_at timestamptz not null default now()
);
create index messages_conversation_time on public.messages(conversation_id,created_at,id);
alter table public.messages enable row level security;
revoke all on public.messages from public,anon,authenticated;
grant select on public.messages to authenticated;
create policy members_read on public.messages for select to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id and (select auth.uid()) in(c.requester_id,c.helper_id)));
create table public.notification_preferences(user_id uuid primary key references auth.users(id) on delete cascade, chat_enabled boolean not null default false);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public,anon,authenticated;
grant select,insert,update on public.notification_preferences to authenticated;
create policy own_preferences on public.notification_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create table public.device_tokens(token text primary key check(token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'), user_id uuid not null references auth.users(id) on delete cascade, platform text not null check(platform in('android','ios')), updated_at timestamptz not null default now());
create index device_tokens_user on public.device_tokens(user_id);
alter table public.device_tokens enable row level security;
revoke all on public.device_tokens from public,anon,authenticated;
grant select,delete on public.device_tokens to authenticated;
create policy own_tokens on public.device_tokens for select to authenticated using(user_id=(select auth.uid()));
create policy delete_tokens on public.device_tokens for delete to authenticated using(user_id=(select auth.uid()));
create table private.chat_deliveries(message_id uuid not null references public.messages(id) on delete cascade, token text not null, claimed_at timestamptz not null default now(), ticket_id text, error text, primary key(message_id,token));
alter table private.chat_deliveries enable row level security;
revoke all on private.chat_deliveries from public,anon,authenticated;

-- Lifecycle trigger executes inside the same request lock/transaction as M4 actions.
create function private.sync_chat() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.accepted_offer_id is distinct from new.accepted_offer_id or new.status<>'accepted' then
  update public.conversations set closed_at=now() where request_id=new.id and closed_at is null;
 end if;
 if new.status='accepted' then
  insert into public.conversations(request_id,offer_id,requester_id,helper_id)
  values(new.id,new.accepted_offer_id,new.owner_id,new.accepted_helper_id)
  on conflict(request_id) where closed_at is null do nothing;
 end if;
 return new;
end $$;
revoke all on function private.sync_chat() from public,anon,authenticated;
create trigger sync_chat after update on public.help_requests for each row execute function private.sync_chat();
insert into public.conversations(request_id,offer_id,requester_id,helper_id)
select id,accepted_offer_id,owner_id,accepted_helper_id from public.help_requests where status='accepted';

create function private.send_chat(target_conversation uuid,message_id uuid,message_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_offer_actor(); c public.conversations%rowtype; prior public.messages%rowtype; rid uuid;
begin
 select request_id into rid from public.conversations where id=target_conversation;
 perform 1 from public.help_requests where id=rid for update;
 select * into c from public.conversations where id=target_conversation for update;
 if not found or actor not in(c.requester_id,c.helper_id) then raise exception 'Chat unavailable.' using errcode='42501'; end if;
 if exists(select 1 from public.blocks where (blocker_id=c.requester_id and blocked_id=c.helper_id) or (blocker_id=c.helper_id and blocked_id=c.requester_id)) then raise exception 'Messaging is blocked.' using errcode='42501'; end if;
 select * into prior from public.messages where id=message_id;
 if found then
  if prior.sender_id=actor and prior.conversation_id=c.id and prior.body=btrim(message_body) then return prior.id; end if;
  raise exception 'Message ID already used.' using errcode='23505';
 end if;
 if c.closed_at is not null then raise exception 'This chat is read-only.' using errcode='23514'; end if;
 insert into public.messages(id,conversation_id,sender_id,body) values(message_id,c.id,actor,btrim(message_body));
 return message_id;
end $$;
create function public.send_chat(target_conversation uuid,message_id uuid,message_body text) returns uuid language sql security invoker set search_path='' as $$select private.send_chat(target_conversation,message_id,message_body)$$;
create function private.register_chat_device(push_token text,device_platform text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_offer_actor();
begin
 insert into public.device_tokens(token,user_id,platform) values(push_token,actor,device_platform)
 on conflict(token) do update set user_id=actor,platform=excluded.platform,updated_at=now();
end $$;
create function public.register_chat_device(push_token text,device_platform text) returns void language sql security invoker set search_path='' as $$select private.register_chat_device(push_token,device_platform)$$;
revoke all on function private.send_chat(uuid,uuid,text),private.register_chat_device(text,text),public.send_chat(uuid,uuid,text),public.register_chat_device(text,text) from public,anon,authenticated;
grant execute on function private.send_chat(uuid,uuid,text),private.register_chat_device(text,text),public.send_chat(uuid,uuid,text),public.register_chat_device(text,text) to authenticated;

-- Service-only claim: preferences/membership/block checks happen before claiming each token.
create function public.claim_chat_push(target_message uuid,actor uuid) returns table(token text) language plpgsql security invoker set search_path='' as $$
begin
 return query
 insert into private.chat_deliveries(message_id,token)
 select m.id,t.token from public.messages m join public.conversations c on c.id=m.conversation_id
 join public.notification_preferences p on p.user_id=case when m.sender_id=c.requester_id then c.helper_id else c.requester_id end
 join public.device_tokens t on t.user_id=p.user_id
 where m.id=target_message and m.sender_id=actor and p.chat_enabled and c.closed_at is null
 and not exists(select 1 from public.blocks b where (b.blocker_id=c.requester_id and b.blocked_id=c.helper_id) or (b.blocker_id=c.helper_id and b.blocked_id=c.requester_id))
 on conflict do nothing returning chat_deliveries.token;
end $$;
revoke all on function public.claim_chat_push(uuid,uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update on private.chat_deliveries to service_role;
grant execute on function public.claim_chat_push(uuid,uuid) to service_role;
alter publication supabase_realtime add table public.messages;
create function private.check_offer_blocks() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('pending','accepted') and exists(select 1 from public.blocks b where (b.blocker_id=new.requester_id and b.blocked_id=new.helper_id) or (b.blocker_id=new.helper_id and b.blocked_id=new.requester_id)) then raise exception 'Offers between these neighbors are blocked.' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function private.check_offer_blocks() from public,anon,authenticated;
create trigger check_offer_blocks before insert or update on public.offers for each row execute function private.check_offer_blocks();
notify pgrst,'reload schema';
commit;
