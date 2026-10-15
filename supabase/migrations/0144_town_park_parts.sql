-- 公園の部品を21種類ふやす（ユーザー指定：アニメーションつき・人が遊ぶ・見栄えのよい部品）。0143 の後に適用する。
-- 価格・層・公園の評価値は src/lib/games/town-builder.ts の PARK_PARTS と同じ。購入と配置の検証はこれまでどおり
-- town_construction_cost がこの一覧を読んで行うので、ほかの関数は変えない。
begin;

-- The catalog below is shared with src/lib/games/town-builder.ts / town-progression.ts.
create or replace function public.town_part_catalog()
returns table(scope text,part text,price integer,layer text,value integer,kinds text[]) language sql immutable set search_path=public as $$
values
('park','tree',70,'object',3,array[]::text[]),
('park','flowers',60,'object',2,array[]::text[]),
('park','bench',80,'object',2,array[]::text[]),
('park','fountain',180,'object',3,array[]::text[]),
('park','playground',240,'object',4,array[]::text[]),
('park','path',25,'ground',0,array[]::text[]),
('park','light',90,'object',1,array[]::text[]),
('park','cherry',130,'object',4,array[]::text[]),
('park','pine',90,'object',3,array[]::text[]),
('park','hedge',65,'object',2,array[]::text[]),
('park','arch',180,'object',4,array[]::text[]),
('park','swings',220,'object',4,array[]::text[]),
('park','sandbox',120,'object',3,array[]::text[]),
('park','picnic',150,'object',3,array[]::text[]),
('park','gazebo',320,'object',5,array[]::text[]),
('park','trash',45,'object',1,array[]::text[]),
('park','bikeRack',100,'object',2,array[]::text[]),
('park','pond',260,'object',4,array[]::text[]),
('park','sculpture',210,'object',3,array[]::text[]),
('park','clock',190,'object',2,array[]::text[]),
('park','stones',40,'ground',0,array[]::text[]),
('park','seesaw',160,'object',3,array[]::text[]),
('park','springRider',110,'object',2,array[]::text[]),
('park','globe',210,'object',3,array[]::text[]),
('park','carousel',680,'object',6,array[]::text[]),
('park','jungleGym',190,'object',3,array[]::text[]),
('park','splashPad',280,'object',4,array[]::text[]),
('park','bars',90,'object',2,array[]::text[]),
('park','basketball',230,'object',3,array[]::text[]),
('park','maple',140,'object',4,array[]::text[]),
('park','ginkgo',130,'object',4,array[]::text[]),
('park','wisteria',360,'object',5,array[]::text[]),
('park','flowerField',150,'object',3,array[]::text[]),
('park','bamboo',110,'object',3,array[]::text[]),
('park','foodCart',320,'object',4,array[]::text[]),
('park','parasol',140,'object',3,array[]::text[]),
('park','drinkFountain',60,'object',1,array[]::text[]),
('park','bandstand',450,'object',5,array[]::text[]),
('park','windmill',420,'object',5,array[]::text[]),
('park','flowerClock',300,'object',4,array[]::text[]),
('park','lantern',120,'object',2,array[]::text[]),
('park','flagPole',130,'object',2,array[]::text[]),
('facility','garden',90,'object',0,array['house','shop']::text[]),
('facility','terrace',220,'object',0,array['house','shop']::text[]),
('facility','light',70,'object',0,array['house','shop','station','road']::text[]),
('facility','sign',120,'object',0,array['shop']::text[]),
('facility','storage',220,'object',0,array['factory']::text[]),
('facility','greenbelt',140,'object',0,array['factory']::text[]),
('facility','solar',260,'object',0,array['factory']::text[]),
('facility','bench',90,'object',0,array['station']::text[]),
('facility','vending',160,'object',0,array['shop','station']::text[]),
('facility','canopy',180,'object',0,array['house','shop']::text[]),
('facility','planter',80,'object',0,array['house','shop','station']::text[])
$$;
revoke all on function public.town_part_catalog() from public,anon,authenticated;

notify pgrst, 'reload schema';
commit;
