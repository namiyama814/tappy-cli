# tappy

[tap-py.com](http://tap-py.com/) の日程調整をターミナルから操作する CLI です。公開 API はないので、サイトの HTML フォームを読み書きします。

イベントの URL は、そのページを開くための秘密です。作成したら控えてください。1 か月以上出欠の登録や変更がないイベントは、サイト側で削除されます。

## 必要なもの

Node.js 20 以上

## セットアップ

```bash
npm install
npm run build
```

`dist/index.js` がコマンドです。`npm link` すると `tappy` として使えます。

ベース URL の既定は `http://tap-py.com` です。`--base-url` か環境変数 `TAPPY_BASE_URL` で変えられます。

## イベントを作る

時間割形式です。縦軸は時限、`--lunch` で末尾に「昼休み」、`--weekend` で土日を足します。時限数の既定は 5 です。

```bash
node dist/index.js create \
  --name "勉強会" \
  --description "来週の空きコマ" \
  --timetable \
  --periods 5 \
  --lunch
```

カレンダー形式です。横軸は `M/D`、縦軸は 1 時間刻みです。開始日を省略すると今日から、日数の既定は 5、時刻の既定は 09:00 から 17:00 です。

```bash
node dist/index.js create \
  --name "打ち合わせ" \
  --description "午前か午後" \
  --calendar \
  --from 10/1 \
  --days 7 \
  --start 09:00 \
  --end 17:00
```

縦軸と横軸を直接指定することもできます。`--row` と `--col` は繰り返せて、テンプレートの軸を上書きします。ラベルは 12 文字以内、軸はそれぞれ 30 件までです。イベント名は 40 文字以内です。

```bash
node dist/index.js create \
  --name "打ち合わせ" \
  --description "午前か午後" \
  --row 午前 \
  --row 午後 \
  --col 10/1 \
  --col 10/2
```

`--password` は編集用パスワードです。CLI には保存しません。

作成に成功すると公開 URL を表示します。

## 出欠を見る

URL でも ID でも指定できます。

```bash
node dist/index.js show http://tap-py.com/abcdefgh
node dist/index.js show abcdefgh --json
```

人数の表と、回答があるマスを人数の多い順に出します。`--json` は表のデータに加え、`best` へその並びを入れます。

## 空きマスを登録する

`--cell` は `行ラベル,列ラベル` です。ラベルは表の表示と完全一致させて、空いているマスだけ繰り返します。名前は 20 文字以内です。

```bash
node dist/index.js answer abcdefgh \
  --name 山田 \
  --cell "1,Mon" \
  --cell "2,Tue" \
  --comment "1限と火曜2限が空いています"
```

存在しないマスを指定すると、そのイベントの行と列を表示して失敗します。

## 範囲外

編集用パスワードでのイベント編集と、登録済みの出欠の更新は含みません。

## テスト

```bash
npm test
```
