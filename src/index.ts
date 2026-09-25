#!/usr/bin/env node
import { Command } from "commander";
import { answerBoard, createBoard, parseCellSpec, showBoard } from "./client/api.js";
import { TappyError, TappyHttp } from "./client/http.js";
import { boardToJson, renderBoard } from "./render.js";
import { resolveAxes } from "./templates.js";

const DEFAULT_BASE_URL = process.env.TAPPY_BASE_URL ?? "http://tap-py.com";

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function requireInt(value: string, label: string): number {
  if (!/^\d+$/.test(value)) {
    throw new TappyError(`${label}は整数で指定してください`);
  }
  return Number(value);
}

function httpFrom(baseUrl: string): TappyHttp {
  return new TappyHttp(baseUrl);
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("tappy")
    .description("tap-py.com の日程調整をターミナルから操作します")
    .version("0.1.0");

  program
    .command("create")
    .description("イベントを作成し、公開 URL を表示する")
    .requiredOption("--name <name>", "イベント名（40文字以内）")
    .requiredOption("--description <text>", "イベントの詳細")
    .option("--password <password>", "編集用パスワード（保存しません）")
    .option("--timetable", "時間割形式にする")
    .option("--calendar", "カレンダー形式にする")
    .option("--periods <n>", "時限数（1-10）", "5")
    .option("--lunch", "昼休みの行を追加する")
    .option("--weekend", "土日の列を追加する")
    .option("--from <M/D>", "開始日（未指定は今日）")
    .option("--days <n>", "日数（1-30）", "5")
    .option("--start <HH:00>", "開始時刻", "09:00")
    .option("--end <HH:00>", "終了時刻", "17:00")
    .option("--row <label>", "縦軸ラベル。繰り返すとテンプレートの縦軸を上書きする", collect, [] as string[])
    .option("--col <label>", "横軸ラベル。繰り返すとテンプレートの横軸を上書きする", collect, [] as string[])
    .option("--base-url <url>", "ベース URL", DEFAULT_BASE_URL)
    .action(async (opts: {
      name: string;
      description: string;
      password?: string;
      timetable?: boolean;
      calendar?: boolean;
      periods: string;
      lunch?: boolean;
      weekend?: boolean;
      from?: string;
      days: string;
      start: string;
      end: string;
      row: string[];
      col: string[];
      baseUrl: string;
    }) => {
      const timetable = Boolean(opts.timetable);
      const calendar = Boolean(opts.calendar);
      const axes = resolveAxes({
        timetable,
        calendar,
        periods: timetable ? requireInt(opts.periods, "時間数") : 5,
        lunch: Boolean(opts.lunch),
        weekend: Boolean(opts.weekend),
        from: opts.from,
        days: calendar ? requireInt(opts.days, "日数") : 5,
        start: opts.start,
        end: opts.end,
        rows: opts.row.map((label) => label.trim()),
        columns: opts.col.map((label) => label.trim()),
      });
      const created = await createBoard(httpFrom(opts.baseUrl), {
        subject: opts.name.trim(),
        description: opts.description.trim(),
        password: opts.password,
        rows: axes.rows,
        columns: axes.columns,
      });
      console.log("作成しました");
      console.log("");
      console.log(created.url);
      console.log("");
      console.log("この URL を控えてください。URL が分からなくなると、ページを開けません。");
      if (opts.password) {
        console.log("編集用パスワードは保存していません。手元に控えてください。");
      }
    });

  program
    .command("show")
    .description("イベントの出欠を表示する")
    .argument("<target>", "イベント URL または ID")
    .option("--json", "JSON で出力する")
    .option("--base-url <url>", "ベース URL", DEFAULT_BASE_URL)
    .action(async (target: string, opts: { json?: boolean; baseUrl: string }) => {
      const board = await showBoard(httpFrom(opts.baseUrl), target);
      if (opts.json) {
        console.log(JSON.stringify(boardToJson(board), null, 2));
        return;
      }
      console.log(renderBoard(board));
    });

  program
    .command("answer")
    .description("空きマスを登録する")
    .argument("<target>", "イベント URL または ID")
    .requiredOption("--name <name>", "名前（20文字以内）")
    .option("--password <password>", "自分の出欠をあとから編集するためのパスワード")
    .option("--comment <text>", "コメント")
    .option("--cell <row,col>", "空いているマス。行ラベル,列ラベル。繰り返し指定できる", collect, [] as string[])
    .option("--base-url <url>", "ベース URL", DEFAULT_BASE_URL)
    .action(async (
      target: string,
      opts: { name: string; password?: string; comment?: string; cell: string[]; baseUrl: string },
    ) => {
      const board = await answerBoard(httpFrom(opts.baseUrl), target, {
        name: opts.name.trim(),
        password: opts.password,
        comment: opts.comment,
        cells: opts.cell.map(parseCellSpec),
      });
      console.log(`登録しました: ${opts.name.trim()}`);
      console.log("");
      console.log(renderBoard(board));
    });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
