-- Google Placesで取得した住所と、以前の下書きに残った行政区分が食い違ったデータを修復する。
-- 今回確認された大垣市の誤分類を直し、異常な位置精度値も除去する。

update public.spots
set prefecture_code = '21',
    municipality_code = '21202'
where address like '%岐阜県大垣市%'
  and (prefecture_code <> '21' or municipality_code <> '21202');

update public.spots
set location_accuracy_m = null
where location_accuracy_m = 'NaN'::double precision;

alter table public.spots drop constraint if exists spots_accuracy_positive;
alter table public.spots add constraint spots_accuracy_positive
  check (
    location_accuracy_m is null
    or (
      location_accuracy_m <> 'NaN'::double precision
      and location_accuracy_m >= 0
    )
  );
