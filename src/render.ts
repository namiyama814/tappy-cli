import type { Board, Member } from "./client/parse.js";

export type RankedCell = {
  row: string;
  column: string;
  count: number;
  members: Member[];
};

export function bestCells(board: Board): RankedCell[] {
  const cells: Array<RankedCell & { rowIndex: number; columnIndex: number }> = [];
  board.rows.forEach((row, rowIndex) => {
    row.cells.forEach((cell, columnIndex) => {
      cells.push({
        row: row.label,
        column: cell.column,
        count: cell.count,
        members: cell.members,
        rowIndex,
        columnIndex,
      });
    });
  });
  cells.sort(
    (a, b) => b.count - a.count || a.rowIndex - b.rowIndex || a.columnIndex - b.columnIndex,
  );
  return cells.map(({ row, column, count, members }) => ({ row, column, count, members }));
}

export function boardToJson(board: Board): Board & {
  best: Array<{ row: string; column: string; count: number; members: string[] }>;
} {
  return {
    ...board,
    best: bestCells(board)
      .filter((cell) => cell.count > 0)
      .map((cell) => ({
        row: cell.row,
        column: cell.column,
        count: cell.count,
        members: cell.members.map((member) => member.name),
      })),
  };
}

export function renderBoard(board: Board): string {
  const lines: string[] = [board.title];
  if (board.description) lines.push(board.description);
  lines.push("", formatTable(board), "");

  const positive = bestCells(board).filter((cell) => cell.count > 0);
  if (positive.length === 0) {
    lines.push("まだ回答がありません。");
  } else {
    lines.push("人数の多い順:");
    for (const cell of positive) {
      const names = cell.members.map((member) => member.name).join(", ");
      lines.push(`  ${cell.row}  ${cell.column}  ${cell.count}人  ${names}`);
    }
  }

  lines.push("");
  const memberNames = board.members.map((member) => member.name);
  lines.push(memberNames.length > 0 ? `メンバー: ${memberNames.join(", ")}` : "メンバー: なし");
  lines.push(board.url);
  return lines.join("\n");
}

function formatTable(board: Board): string {
  const rows = [
    ["", ...board.columns],
    ...board.rows.map((row) => [row.label, ...row.cells.map((cell) => String(cell.count))]),
  ];
  const widths = rows[0]?.map((_, index) => {
    return Math.max(...rows.map((row) => displayWidth(row[index] ?? "")));
  }) ?? [];
  return rows
    .map((row) => row.map((cell, index) => pad(cell, widths[index] ?? 0)).join("  "))
    .join("\n");
}

function displayWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    width += code > 0xff ? 2 : 1;
  }
  return width;
}

function pad(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - displayWidth(value)));
}
