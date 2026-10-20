begin;
alter function public.verify_chat_worker(text) set schema private;
create function public.verify_chat_worker(worker_secret text) returns boolean language sql security invoker set search_path='' as $$select private.verify_chat_worker(worker_secret)$$;
revoke all on function private.verify_chat_worker(text),public.verify_chat_worker(text) from public,anon,authenticated;
grant execute on function private.verify_chat_worker(text),public.verify_chat_worker(text) to service_role;
commit;
