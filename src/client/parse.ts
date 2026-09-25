import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { TappyError } from "./http.js";

export type Member = {
  id: string;
  name: string;
};

export type Cell = {
  column: string;
  count: number;
  members: Member[];
};

export type BoardRow = {
  label: string;
  cells: Cell[];
};

export type Board = {
  slug: string;
  url: string;
  title: string;
  description: string;
  columns: string[];
  rows: BoardRow[];
  members: Member[];
};

export type RegisterSlot = {
  index: number;
  row: string;
  column: string;
  rowId: string;
  columnId: string;
};

const RESERVED = new Set(["create", "usage", "faq", "css", "js", "img"]);

export function parseSlug(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new TappyError("イベントの URL か ID を指定してください");
  }

  if (/^[0-9a-z]+$/i.test(trimmed)) {
    if (RESERVED.has(trimmed.toLowerCase())) {
      throw new TappyError(`イベントの指定が不正です: ${target}`);
    }
    return trimmed;
  }

  let url: URL;
  try {
    url = trimmed.startsWith("/") ? new URL(trimmed, "http://tap-py.com") : new URL(trimmed);
  } catch {
    throw new TappyError(`イベントの指定が不正です: ${target}`);
  }

  const segment = url.pathname.split("/").filter(Boolean)[0];
  if (!segment || !/^[0-9a-z]+$/i.test(segment) || RESERVED.has(segment.toLowerCase())) {
    throw new TappyError(`イベントの指定が不正です: ${target}`);
  }
  return segment;
}

export function pageErrors(html: string): string[] {
  const $ = cheerio.load(html);
  const messages: string[] = [];
  const flash = collapse($("#flashMessage").text());
  if (flash) messages.push(flash);
  $(".error-message").each((_, el) => {
    const text = collapse($(el).text());
    if (text) messages.push(text);
  });
  return messages;
}

export function parseBoard(html: string, slug: string, url: string): Board {
  const $ = cheerio.load(html);
  const table = $("#attendance");
  if (table.length === 0) {
    const errors = pageErrors(html);
    throw new TappyError(errors[0] ?? "イベントページを読み取れませんでした");
  }

  const heading = $("article header h1").first().clone();
  heading.find(".editlink").remove();
  const title = collapse(heading.text());
  const description = collapse($("article header p").first().text());

  const columns: string[] = [];
  table
    .find("tr")
    .first()
    .find("th")
    .each((index, el) => {
      if (index === 0) return;
      columns.push(collapse($(el).text()));
    });

  const rows: BoardRow[] = [];
  table
    .find("tr")
    .slice(1)
    .each((_, rowEl) => {
      const label = collapse($(rowEl).find("th").first().text());
      const cells: Cell[] = [];
      $(rowEl)
        .find("td")
        .each((index, cellEl) => {
          const column = columns[index] ?? "";
          const members = readMembers($, $(cellEl));
          const countText = collapse($(cellEl).find(".count").first().text());
          const parsed = Number.parseInt(countText, 10);
          cells.push({
            column,
            count: Number.isNaN(parsed) ? members.length : parsed,
            members,
          });
        });
      rows.push({ label, cells });
    });

  return {
    slug,
    url,
    title,
    description,
    columns,
    rows,
    members: readMembers($, $("#memberlist")),
  };
}

export function parseRegisterForm(html: string): RegisterSlot[] {
  const $ = cheerio.load(html);
  const form = $("#MemberRegisterForm");
  if (form.length === 0) {
    const errors = pageErrors(html);
    throw new TappyError(errors[0] ?? "出欠登録フォームを読み取れませんでした");
  }

  const table = form.find("table").first();
  const columns: string[] = [];
  table
    .find("tr")
    .first()
    .find("th")
    .each((index, el) => {
      if (index === 0) return;
      columns.push(collapse($(el).text()));
    });

  const slots: RegisterSlot[] = [];
  table
    .find("tr")
    .slice(1)
    .each((_, rowEl) => {
      const row = collapse($(rowEl).find("th").first().text());
      $(rowEl)
        .find("td")
        .each((index, cellEl) => {
          const column = columns[index] ?? "";
          const checkbox = $(cellEl).find('input[type="checkbox"][name*="[is_valied]"]').first();
          const field = checkbox.attr("name") ?? "";
          const match = /data\[Attendance\]\[(\d+)\]/.exec(field);
          if (!match) return;
          const slotIndex = Number(match[1]);
          const prefix = `data[Attendance][${slotIndex}]`;
          const rowId = $(cellEl).find(`input[name="${prefix}[board_row_id]"]`).attr("value") ?? "";
          const columnId =
            $(cellEl).find(`input[name="${prefix}[board_column_id]"]`).attr("value") ?? "";
          if (!rowId || !columnId) return;
          slots.push({ index: slotIndex, row, column, rowId, columnId });
        });
    });

  if (slots.length === 0) {
    throw new TappyError("出欠登録フォームにマスがありません");
  }
  return slots;
}

export function extractCreatedSlug(finalUrl: string, html: string): string {
  const fromUrl = slugFromUrl(finalUrl);
  if (fromUrl) return fromUrl;

  const $ = cheerio.load(html);
  const candidates: string[] = [];
  $("input").each((_, el) => {
    const value = $(el).attr("value");
    if (value) candidates.push(value);
  });
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) candidates.push(href);
  });

  for (const candidate of candidates) {
    try {
      return parseSlug(candidate);
    } catch {
      continue;
    }
  }

  const errors = pageErrors(html);
  throw new TappyError(errors[0] ?? "作成後のイベント URL を読み取れませんでした");
}

function slugFromUrl(value: string): string | null {
  try {
    return parseSlug(value);
  } catch {
    return null;
  }
}

function readMembers<T extends AnyNode>($: cheerio.CheerioAPI, scope: cheerio.Cheerio<T>): Member[] {
  const members: Member[] = [];
  scope.find("li").each((_, el) => {
    const id = collapse($(el).find(".member_id").first().text());
    const name = collapse($(el).find(".member_name").first().text());
    if (name) members.push({ id, name });
  });
  return members;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
