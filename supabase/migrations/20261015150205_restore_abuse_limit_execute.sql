begin;

-- Production applied abuse_protection before the older security baseline.
-- Filling that history gap revokes this grant. Restore only the backend RPC;
-- never grant direct access to counters, policies or the pruning helper.
revoke all on function public.consume_abuse_limit(uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_abuse_limit(uuid, text) to service_role;

commit;
