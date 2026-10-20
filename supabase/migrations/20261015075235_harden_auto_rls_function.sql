-- This is an event-trigger function, not a client RPC.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
