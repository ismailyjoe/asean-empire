-- ASEAN Empire: run once in the Supabase SQL Editor.
-- Scores are public, self-reported results for a casual game.
-- Private table: clients can use only the two bounded functions below.
begin;
create table if not exists public.empire_scores (
 campaign_id uuid primary key,
 player_name text not null check (char_length(player_name) between 2 and 24 and player_name !~ '[[:cntrl:]]'),
 score bigint not null check (score between -1000000000000 and 1000000000000),
 trades integer not null check (trades between 0 and 100000),
 debt bigint not null check (debt between 0 and 1000000000),
 created_at timestamptz not null default now()
);
create index if not exists empire_scores_ranking on public.empire_scores (score desc,created_at asc,campaign_id asc);
alter table public.empire_scores enable row level security;
revoke all on public.empire_scores from public, anon, authenticated;
create or replace function public.get_top25()
returns table (player_name text,score bigint,created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
 select s.player_name,s.score,s.created_at from public.empire_scores s
 order by s.score desc,s.created_at asc,s.campaign_id asc limit 25
$$;
create or replace function public.submit_score(
 p_campaign_id uuid,p_player_name text,p_score bigint,p_trades integer,p_debt bigint
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare clean_name text; result jsonb;
begin
 clean_name := btrim(regexp_replace(p_player_name,'[[:space:]]+',' ','g'));
 if p_campaign_id is null or clean_name is null or char_length(clean_name) not between 2 and 24
 or clean_name ~ '[[:cntrl:]]' or p_score is null or p_score not between -1000000000000 and 1000000000000
 or p_trades is null or p_trades not between 0 and 100000
 or p_debt is null or p_debt not between 0 and 1000000000 then
  raise exception 'Invalid score submission' using errcode = '22023';
 end if;
 insert into public.empire_scores(campaign_id,player_name,score,trades,debt)
 values(p_campaign_id,clean_name,p_score,p_trades,p_debt)
 on conflict (campaign_id) do nothing;
 select jsonb_build_object('campaign_id',s.campaign_id,'player_name',s.player_name,'score',s.score)
 into result from public.empire_scores s where s.campaign_id=p_campaign_id;
 return result;
end
$$;
revoke all on function public.get_top25() from public;
revoke all on function public.submit_score(uuid,text,bigint,integer,bigint) from public;
grant execute on function public.get_top25() to anon,authenticated;
grant execute on function public.submit_score(uuid,text,bigint,integer,bigint) to anon,authenticated;
commit;
