begin;
create function public.record_chat_ticket(target_message uuid,push_token text,push_ticket text,push_error text) returns void language sql security invoker set search_path='' as $$
 update private.chat_deliveries set ticket_id=push_ticket,error=push_error where message_id=target_message and token=push_token;
$$;
revoke all on function public.record_chat_ticket(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_chat_ticket(uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
