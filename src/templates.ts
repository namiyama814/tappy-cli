import { TappyError } from "./client/http.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const WEEKEND = ["Sat", "Sun"];
const MAX_AXES = 30;
const MAX_LABEL = 12;

export type AxisOptions = {
  timetable: boolean;
  calendar: boolean;
  periods: number;
  lunch: boolean;
  weekend: boolean;
  from?: string;
  days: number;
  start: string;
  end: string;
  rows: string[];
  columns: string[];
  now?: Date;
};

export function timetableAxes(options: {
  periods?: number;
  lunch?: boolean;
  weekend?: boolean;
}): { rows: string[]; columns: string[] } {
  const periods = options.periods ?? 5;
  if (!Number.isInteger(periods) || periods < 1 || periods > 10) {
    throw new TappyError("時間数は 1 から 10 にしてください");
  }
  const rows = Array.from({ length: periods }, (_, index) => String(index + 1));
  if (options.lunch) rows.push("昼休み");
  const columns = options.weekend ? [...WEEKDAYS, ...WEEKEND] : [...WEEKDAYS];
  return { rows, columns };
}

export function calendarAxes(options: {
  from?: string;
  days?: number;
  start?: string;
  end?: string;
  now?: Date;
}): { rows: string[]; columns: string[] } {
  const now = options.now ?? new Date();
  const days = options.days ?? 5;
  if (!Number.isInteger(days) || days < 1 || days > MAX_AXES) {
    throw new TappyError("日数は 1 から 30 にしてください");
  }

  const start = parseHour(options.start ?? "09:00");
  const end = parseHour(options.end ?? "17:00");
  if (end < start) {
    throw new TappyError("終了時刻は開始時刻以降にしてください");
  }

  const rows: string[] = [];
  for (let hour = start; hour <= end; hour++) {
    rows.push(`${String(hour).padStart(2, "0")}:00`);
  }

  const from = options.from ?? `${now.getMonth() + 1}/${now.getDate()}`;
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(from);
  if (!match) {
    throw new TappyError("開始日は M/D 形式で指定してください");
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  const date = new Date(now.getFullYear(), month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new TappyError("開始日が不正です");
  }

  const columns: string[] = [];
  for (let index = 0; index < days; index++) {
    columns.push(`${date.getMonth() + 1}/${date.getDate()}`);
    date.setDate(date.getDate() + 1);
  }
  return { rows, columns };
}

export function resolveAxes(options: AxisOptions): { rows: string[]; columns: string[] } {
  if (options.timetable && options.calendar) {
    throw new TappyError("時間割形式とカレンダー形式は同時に指定できません");
  }

  let rows: string[] | undefined;
  let columns: string[] | undefined;
  if (options.timetable) {
    const axes = timetableAxes({
      periods: options.periods,
      lunch: options.lunch,
      weekend: options.weekend,
    });
    rows = axes.rows;
    columns = axes.columns;
  } else if (options.calendar) {
    const axes = calendarAxes({
      from: options.from,
      days: options.days,
      start: options.start,
      end: options.end,
      now: options.now,
    });
    rows = axes.rows;
    columns = axes.columns;
  }

  if (options.rows.length > 0) rows = options.rows;
  if (options.columns.length > 0) columns = options.columns;
  if (!rows || !columns) {
    throw new TappyError(
      "時間割（--timetable）、カレンダー（--calendar）、または --row と --col を指定してください",
    );
  }
  assertAxes(rows, columns);
  return { rows, columns };
}

export function assertAxes(rows: string[], columns: string[]): void {
  if (rows.length === 0 || columns.length === 0) {
    throw new TappyError("縦軸と横軸を1つ以上指定してください");
  }
  if (rows.length > MAX_AXES || columns.length > MAX_AXES) {
    throw new TappyError("縦軸・横軸はそれぞれ30件までです");
  }
  assertLabels(rows, "縦軸");
  assertLabels(columns, "横軸");
}

export function assertSubject(subject: string): void {
  if (!subject) {
    throw new TappyError("イベント名を指定してください");
  }
  if ([...subject].length > 40) {
    throw new TappyError("イベント名は40文字以内にしてください");
  }
}

export function assertMemberName(name: string): void {
  const length = [...name].length;
  if (length < 1 || length > 20) {
    throw new TappyError("名前は1文字以上20文字以内にしてください");
  }
}

function assertLabels(labels: string[], kind: string): void {
  const seen = new Set<string>();
  for (const label of labels) {
    if (!label) {
      throw new TappyError(`${kind}が空です`);
    }
    if ([...label].length > MAX_LABEL) {
      throw new TappyError(`${kind}「${label}」は12文字以内にしてください`);
    }
    if (seen.has(label)) {
      throw new TappyError(`${kind}「${label}」が重複しています`);
    }
    seen.add(label);
  }
}

function parseHour(value: string): number {
  const match = /^(\d{1,2}):00$/.exec(value);
  if (!match) {
    throw new TappyError("時刻は HH:00 形式で指定してください");
  }
  const hour = Number(match[1]);
  if (hour > 23) {
    throw new TappyError("時刻は 00:00 から 23:00 です");
  }
  return hour;
}
