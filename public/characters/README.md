# 犬スキンの画像

このアプリの犬は「重ね着せ」ではなく、スキンごとに丸ごと別の画像セットを
持つ方式です（src/lib/dog-skins.ts の `getFrenchieSrc`）。

```
getFrenchieSrc("default", "walk") => "/characters/default/walk.webp"
getFrenchieSrc("hiking",  "walk") => "/characters/hiking/walk.webp"
```

## フォルダ

- `default/` — 最初から使える犬（すでに全ファイル揃っています）
- `hiking/` — 登山のフレブル（ガチャの `hiking_frenchie` で解放）
- `snow/` — 雪国のフレブル（ガチャの `snow_frenchie` で解放）
- `summer/` — 夏のフレブル（ガチャの `summer_frenchie` で解放）

## 必要なファイル名

どのフォルダにも、同じファイル名（拡張子 `.webp`）で揃えてください。
一覧は `src/lib/dog-skins.ts` の `DOG_POSE_FILES` に定義してあります。

`default/` にはこれより多くのファイルが残っていますが、それらはコードから
参照されていない過去の名残です。新しいスキンを揃えるときは `DOG_POSE_FILES`
に載っているファイル名だけで足ります。

新しいポーズを使うコードを足すときは、`DOG_POSE_FILES` にファイル名を
足してから、4フォルダぶん画像を用意してください。1フォルダぶんしか
用意できていない間は、他のスキンではその画像だけ 404 になります
（アプリ自体は落ちません）。

`hiking/` `snow/` `summer/` はまだ画像が入っていません。画像を置くだけで
動くようにコード側は準備してあります。
