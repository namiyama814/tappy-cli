import { joinUrl, TappyError, TappyHttp } from "./http.js";
import {
  extractCreatedSlug,
  pageErrors,
  parseBoard,
  parseRegisterForm,
  parseSlug,
  type Board,
  type RegisterSlot,
} from "./parse.js";
import { assertMemberName, assertSubject } from "../templates.js";

export type CreateInput = {
  subject: string;
  description: string;
  password?: string;
  rows: string[];
  columns: string[];
};

export type AnswerInput = {
  name: string;
  password?: string;
  comment?: string;
  cells: Array<{ row: string; column: string }>;
};

export function buildCreateBody(input: CreateInput): URLSearchParams {
  assertSubject(input.subject);
  if (!input.description.trim()) {
    throw new TappyError("イベントの詳細を指定してください");
  }
  const params = new URLSearchParams();
  params.append("_method", "POST");
  params.append("data[Board][subject]", input.subject);
  params.append("data[Board][password]", input.password ?? "");
  params.append("data[Board][description]", input.description);
  input.rows.forEach((name, index) => {
    params.append(`data[BoardRow][${index}][name]`, name);
  });
  input.columns.forEach((name, index) => {
    params.append(`data[BoardColumn][${index}][name]`, name);
  });
  return params;
}

export function buildAnswerBody(
  slots: RegisterSlot[],
  selected: ReadonlySet<string>,
  input: Pick<AnswerInput, "name" | "password" | "comment">,
): URLSearchParams {
  const params = new URLSearchParams();
  params.append("_method", "POST");
  for (const slot of slots) {
    const prefix = `data[Attendance][${slot.index}]`;
    params.append(`${prefix}[board_row_id]`, slot.rowId);
    params.append(`${prefix}[board_column_id]`, slot.columnId);
    params.append(`${prefix}[is_valied]`, "0");
    if (selected.has(cellKey(slot.row, slot.column))) {
      params.append(`${prefix}[is_valied]`, "1");
    }
  }
  params.append("data[Member][name]", input.name);
  params.append("data[Member][password]", input.password ?? "");
  params.append("data[Comment][body]", input.comment ?? "");
  return params;
}

export async function createBoard(
  http: TappyHttp,
  input: CreateInput,
): Promise<{ slug: string; url: string }> {
  const body = buildCreateBody(input);
  await http.get("/create");
  const response = await http.post("/create", body);
  const path = new URL(response.url).pathname.replace(/\/+$/, "");
  if (response.status >= 400 || path === "/create" || path.endsWith("/create")) {
    throw new TappyError(pageErrors(response.html)[0] ?? `イベントを作成できませんでした (${response.status})`);
  }
  const slug = extractCreatedSlug(response.url, response.html);
  return { slug, url: joinUrl(http.baseUrl, `/${slug}`) };
}

export async function showBoard(http: TappyHttp, target: string): Promise<Board> {
  const slug = parseSlug(target);
  const response = await http.get(`/${slug}`);
  if (response.status === 404) {
    throw new TappyError("イベントが見つかりません");
  }
  if (response.status >= 400) {
    throw new TappyError(pageErrors(response.html)[0] ?? `取得に失敗しました (${response.status})`);
  }
  return parseBoard(response.html, slug, joinUrl(http.baseUrl, `/${slug}`));
}

export async function answerBoard(
  http: TappyHttp,
  target: string,
  input: AnswerInput,
): Promise<Board> {
  assertMemberName(input.name);
  if (input.cells.length === 0) {
    throw new TappyError("空きマスを --cell で1つ以上指定してください");
  }

  const slug = parseSlug(target);
  const form = await http.get(`/${slug}/register`);
  if (form.status >= 400) {
    throw new TappyError(pageErrors(form.html)[0] ?? `出欠登録ページを開けませんでした (${form.status})`);
  }
  const slots = parseRegisterForm(form.html);
  const selected = new Set<string>();
  const unknown: string[] = [];
  for (const cell of input.cells) {
    const found = slots.some((slot) => slot.row === cell.row && slot.column === cell.column);
    if (!found) unknown.push(`${cell.row},${cell.column}`);
    else selected.add(cellKey(cell.row, cell.column));
  }
  if (unknown.length > 0) {
    const rows = [...new Set(slots.map((slot) => slot.row))].join(", ");
    const columns = [...new Set(slots.map((slot) => slot.column))].join(", ");
    throw new TappyError(`不明なマスです: ${unknown.join(" / ")}\n行: ${rows}\n列: ${columns}`);
  }

  const response = await http.post(`/${slug}/register`, buildAnswerBody(slots, selected, input));
  const path = new URL(response.url).pathname.replace(/\/+$/, "");
  if (response.status >= 400 || path.endsWith("/register")) {
    throw new TappyError(pageErrors(response.html)[0] ?? "出欠の登録に失敗しました");
  }
  return showBoard(http, slug);
}

export function parseCellSpec(spec: string): { row: string; column: string } {
  const index = spec.indexOf(",");
  if (index <= 0 || index === spec.length - 1) {
    throw new TappyError(`マスの指定が不正です: ${spec}（行,列）`);
  }
  const row = spec.slice(0, index).trim();
  const column = spec.slice(index + 1).trim();
  if (!row || !column) {
    throw new TappyError(`マスの指定が不正です: ${spec}（行,列）`);
  }
  return { row, column };
}

export function cellKey(row: string, column: string): string {
  return `${row}\0${column}`;
}
