begin;
alter table private.chat_deliveries add column receipt_status text check(receipt_status in('ok','error')), add column receipt_checked_at timestamptz;
create function public.pending_chat_receipts(sender uuid) returns table(message_id uuid,token text,ticket_id text) language sql security invoker set search_path='' as $$
 select d.message_id,d.token,d.ticket_id from private.chat_deliveries d join public.messages m on m.id=d.message_id
 where m.sender_id=sender and d.ticket_id is not null and d.receipt_status is null and d.claimed_at<now()-interval '15 minutes' and d.claimed_at>now()-interval '24 hours'
 order by d.claimed_at limit 100;
$$;
create function public.record_chat_receipt(push_ticket text,delivery_status text,delivery_error text) returns void language plpgsql security invoker set search_path='' as $$
begin
 update private.chat_deliveries set receipt_status=delivery_status,receipt_checked_at=now(),error=delivery_error where ticket_id=push_ticket;
 if delivery_error='DeviceNotRegistered' then delete from public.device_tokens t where exists(select 1 from private.chat_deliveries d where d.ticket_id=push_ticket and d.token=t.token and t.updated_at<=d.claimed_at);end if;
end $$;
revoke all on function public.pending_chat_receipts(uuid),public.record_chat_receipt(text,text,text) from public,anon,authenticated;
grant execute on function public.pending_chat_receipts(uuid),public.record_chat_receipt(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
