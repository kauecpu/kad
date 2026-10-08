begin;

-- Keep schema creation and private storage outside client-controlled roles.
revoke create on schema public from public, anon, authenticated;
revoke create on schema private from public, anon, authenticated;
revoke usage on schema private from anon;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Supabase also
-- adds direct API-role grants in public. Make every future RPC opt-in instead.
alter default privileges for role postgres
revoke execute on functions from public;

alter default privileges for role postgres in schema public
revoke execute on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema private
revoke execute on functions from anon, authenticated, service_role;

-- New tables and sequences must also receive an explicit client grant. RLS is
-- still mandatory, but it is no longer the only barrier for future objects.
alter default privileges for role postgres in schema public
revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
revoke all on sequences from anon, authenticated;

-- Remove inherited and direct execution from every existing application
-- function, then restore only the reviewed entry points below.
revoke execute on all functions in schema public
from public, anon, authenticated, service_role;

revoke execute on all functions in schema private
from public, anon, authenticated, service_role;

grant execute on function public.is_username_available(text) to anon;

grant execute on function private.question_community_accuracy(text[]) to authenticated;
grant execute on function public.question_community_accuracy(text[]) to authenticated;
grant execute on function public.get_my_admin_access() to authenticated;
grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_list_concursos() to authenticated;
grant execute on function public.admin_save_concurso(jsonb) to authenticated;
grant execute on function public.admin_delete_concurso(text) to authenticated;
grant execute on function public.admin_list_questions() to authenticated;
grant execute on function public.admin_save_question(jsonb) to authenticated;
grant execute on function public.admin_create_import_batch(text, jsonb) to authenticated;
grant execute on function public.admin_list_import_batches() to authenticated;
grant execute on function public.admin_get_import_batch(uuid) to authenticated;
grant execute on function public.admin_set_import_item_decision(uuid, text) to authenticated;
grant execute on function public.admin_update_import_item(uuid, jsonb) to authenticated;
grant execute on function public.admin_apply_import_batch(uuid) to authenticated;
grant execute on function public.admin_rollback_import_batch(uuid) to authenticated;
grant execute on function public.submit_user_feedback(text, text, text, text, text) to authenticated;
grant execute on function public.admin_list_user_feedback() to authenticated;
grant execute on function public.admin_update_user_feedback_status(uuid, text) to authenticated;
grant execute on function public.sync_essay_document(uuid, text, text, integer, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.sync_simulation_session(uuid, text, text, jsonb, timestamptz, timestamptz, timestamptz) to authenticated;
grant execute on function public.record_question_attempt(text, text) to authenticated;
grant execute on function public.admin_preview_question_publication(text[], text, text) to authenticated;
grant execute on function public.admin_apply_question_publication(text[], text, text, text) to authenticated;
grant execute on function public.get_payment_checkout_status(uuid) to authenticated;
grant execute on function public.record_level_activity(jsonb) to authenticated;
grant execute on function public.get_latest_open_payment_checkout() to authenticated;
grant execute on function public.get_current_subscription() to authenticated;
grant execute on function public.set_ranking_opt_in(boolean) to authenticated;
grant execute on function public.get_ranking(text, integer, integer) to authenticated;

grant execute on function public.acquire_payment_checkout_lease(uuid) to service_role;
grant execute on function public.consume_payment_checkout_attempt(uuid, uuid) to service_role;
grant execute on function public.release_payment_checkout_lease(uuid, uuid) to service_role;
grant execute on function public.apply_mercado_pago_payment(uuid, text, text, text, integer, text, timestamptz, timestamptz) to service_role;
grant execute on function public.sync_mercado_pago_subscription(text, text) to service_role;
grant execute on function public.apply_google_play_purchase(uuid, text, text, text, text, timestamptz, boolean, boolean) to service_role;
grant execute on function public.claim_payment_checkout_reconciliation(uuid, uuid) to service_role;
grant execute on function public.claim_payment_webhook(text, text, text, text, boolean) to service_role;
grant execute on function public.finish_payment_webhook(text, uuid, boolean, text) to service_role;
grant execute on function public.sync_mercado_pago_subscription(text, text, timestamptz) to service_role;

commit;
