begin;

-- The achievement key is the second column of the composite primary key, so it
-- needs its own index for FK checks initiated from achievement_definitions.
create index if not exists user_achievements_achievement_key_idx
on public.user_achievements (achievement_key);

commit;