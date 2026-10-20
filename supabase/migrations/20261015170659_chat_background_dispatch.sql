begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
-- Generate a worker-only credential in Vault; it never enters migration source or client output.
select vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'chat_worker_secret','Internal chat worker authentication');
create function public.verify_chat_worker(worker_secret text) returns boolean language sql security definer set search_path='' as $$
 select worker_secret is not null and worker_secret=(select decrypted_secret from vault.decrypted_secrets where name='chat_worker_secret');
$$;
-- This definer is service-only and reads Vault solely to compare a caller-provided credential.
revoke all on function public.verify_chat_worker(text) from public,anon,authenticated;
grant execute on function public.verify_chat_worker(text) to service_role;
create function public.pending_chat_push() returns table(message_id uuid,sender_id uuid) language sql security invoker set search_path='' as $$
 select m.id,m.sender_id from public.messages m join public.conversations c on c.id=m.conversation_id
 where m.created_at>now()-interval '10 minutes' and c.closed_at is null
 and exists(select 1 from public.notification_preferences p join public.device_tokens t on t.user_id=p.user_id
 where p.user_id=case when m.sender_id=c.requester_id then c.helper_id else c.requester_id end and p.chat_enabled
 and not exists(select 1 from private.chat_deliveries d where d.message_id=m.id and d.token=t.token))
 and not exists(select 1 from public.blocks b where (b.blocker_id=c.requester_id and b.blocked_id=c.helper_id) or (b.blocker_id=c.helper_id and b.blocked_id=c.requester_id))
 order by m.created_at limit 50;
$$;
revoke all on function public.pending_chat_push() from public,anon,authenticated;
grant execute on function public.pending_chat_push() to service_role;
create or replace function public.pending_chat_receipts(sender uuid) returns table(message_id uuid,token text,ticket_id text) language sql security invoker set search_path='' as $$
 select d.message_id,d.token,d.ticket_id from private.chat_deliveries d join public.messages m on m.id=d.message_id
 where (sender is null or m.sender_id=sender) and d.ticket_id is not null and d.receipt_status is null and d.claimed_at<now()-interval '15 minutes' and d.claimed_at>now()-interval '24 hours'
 order by d.claimed_at limit 100;
$$;
create function private.enqueue_chat_push() returns bigint language plpgsql security invoker set search_path='' as $$
declare result bigint;
begin
 if exists(select 1 from public.pending_chat_push()) or exists(select 1 from public.pending_chat_receipts(null)) then
  select net.http_post(url:='https://osdmzewnboyxtetbzvkj.supabase.co/functions/v1/chat-worker',headers:=jsonb_build_object('Content-Type','application/json','x-chat-worker',(select decrypted_secret from vault.decrypted_secrets where name='chat_worker_secret')),body:='{}'::jsonb,timeout_milliseconds:=60000) into result;
 end if;
 return result;
end $$;
revoke all on function private.enqueue_chat_push() from public,anon,authenticated;
select cron.schedule('chat-push-worker','* * * * *','select private.enqueue_chat_push()');
notify pgrst,'reload schema';
commit;
