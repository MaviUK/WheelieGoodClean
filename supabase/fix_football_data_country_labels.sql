-- Fix existing football-data.co.uk rows that were imported before country/division mapping was added.
-- Run this once in Supabase SQL Editor.

update public.football_data_matches
set country_code = 'ENG', country_name = 'England', division_name = 'Premier League'
where division = 'E0';

update public.football_data_matches
set country_code = 'ENG', country_name = 'England', division_name = 'Championship'
where division = 'E1';

update public.football_data_matches
set country_code = 'ENG', country_name = 'England', division_name = 'League One'
where division = 'E2';

update public.football_data_matches
set country_code = 'ENG', country_name = 'England', division_name = 'League Two'
where division = 'E3';

update public.football_data_matches
set country_code = 'ENG', country_name = 'England', division_name = 'National League'
where division = 'EC';

update public.football_data_matches
set country_code = 'SCO', country_name = 'Scotland', division_name = 'Premiership'
where division = 'SC0';

update public.football_data_matches
set country_code = 'SCO', country_name = 'Scotland', division_name = 'Championship'
where division = 'SC1';

update public.football_data_matches
set country_code = 'SCO', country_name = 'Scotland', division_name = 'League One'
where division = 'SC2';

update public.football_data_matches
set country_code = 'SCO', country_name = 'Scotland', division_name = 'League Two'
where division = 'SC3';

update public.football_data_matches
set country_code = 'DEU', country_name = 'Germany', division_name = 'Bundesliga'
where division = 'D1';

update public.football_data_matches
set country_code = 'DEU', country_name = 'Germany', division_name = '2. Bundesliga'
where division = 'D2';

update public.football_data_matches
set country_code = 'ITA', country_name = 'Italy', division_name = 'Serie A'
where division = 'I1';

update public.football_data_matches
set country_code = 'ITA', country_name = 'Italy', division_name = 'Serie B'
where division = 'I2';

update public.football_data_matches
set country_code = 'ESP', country_name = 'Spain', division_name = 'La Liga'
where division = 'SP1';

update public.football_data_matches
set country_code = 'ESP', country_name = 'Spain', division_name = 'Segunda Division'
where division = 'SP2';

update public.football_data_matches
set country_code = 'FRA', country_name = 'France', division_name = 'Ligue 1'
where division = 'F1';

update public.football_data_matches
set country_code = 'FRA', country_name = 'France', division_name = 'Ligue 2'
where division = 'F2';

update public.football_data_matches
set country_code = 'NLD', country_name = 'Netherlands', division_name = 'Eredivisie'
where division = 'N1';

update public.football_data_matches
set country_code = 'BEL', country_name = 'Belgium', division_name = 'Jupiler League'
where division = 'B1';

update public.football_data_matches
set country_code = 'PRT', country_name = 'Portugal', division_name = 'Liga I'
where division = 'P1';

update public.football_data_matches
set country_code = 'TUR', country_name = 'Turkey', division_name = 'Ligi 1'
where division = 'T1';

update public.football_data_matches
set country_code = 'GRC', country_name = 'Greece', division_name = 'Ethniki Katigoria'
where division = 'G1';

select country_name, division, division_name, count(*) as rows
from public.football_data_matches
group by country_name, division, division_name
order by country_name, division;
