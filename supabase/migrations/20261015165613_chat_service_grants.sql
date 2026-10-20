begin;
grant select on public.messages,public.conversations,public.notification_preferences,public.blocks to service_role;
grant select,delete on public.device_tokens to service_role;
commit;
