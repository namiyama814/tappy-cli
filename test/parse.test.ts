import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TappyError } from "../src/client/http.js";
import {
  extractCreatedSlug,
  pageErrors,
  parseBoard,
  parseRegisterForm,
  parseSlug,
} from "../src/client/parse.js";

const boardHtml = readFileSync(new URL("./fixtures/board.html", import.meta.url), "utf8");
const registerHtml = readFileSync(new URL("./fixtures/register.html", import.meta.url), "utf8");

describe("parseSlug", () => {
  it("accepts a slug and a board URL", () => {
    expect(parseSlug("abcd1234")).toBe("abcd1234");
    expect(parseSlug("http://tap-py.com/abcd1234")).toBe("abcd1234");
    expect(parseSlug("http://tap-py.com/abcd1234/register")).toBe("abcd1234");
  });

  it("rejects reserved paths", () => {
    expect(() => parseSlug("http://tap-py.com/create")).toThrow(TappyError);
    expect(() => parseSlug("")).toThrow(TappyError);
  });
});

describe("parseBoard", () => {
  it("reads the title, counts, and members", () => {
    const board = parseBoard(boardHtml, "abcd1234", "http://tap-py.com/abcd1234");
    expect(board.title).toBe("勉強会");
    expect(board.description).toBe("来週の空きコマ");
    expect(board.columns).toEqual(["Mon", "Tue"]);
    expect(board.rows[0]?.cells[0]).toMatchObject({
      column: "Mon",
      count: 2,
      members: [
        { id: "10", name: "Alice" },
        { id: "11", name: "Bob" },
      ],
    });
    expect(board.rows[1]?.cells[0]?.count).toBe(0);
    expect(board.members.map((member) => member.name)).toEqual(["Alice", "Bob"]);
  });

  it("surfaces flash messages when the table is missing", () => {
    expect(pageErrors('<div id="flashMessage">失敗しました</div>')).toEqual(["失敗しました"]);
    expect(() => parseBoard('<div id="flashMessage">期限切れ</div>', "x", "http://tap-py.com/x")).toThrow(
      "期限切れ",
    );
  });
});

describe("parseRegisterForm", () => {
  it("maps labels to attendance ids", () => {
    const slots = parseRegisterForm(registerHtml);
    expect(slots).toEqual([
      { index: 0, row: "1", column: "Mon", rowId: "100", columnId: "200" },
      { index: 1, row: "1", column: "Tue", rowId: "100", columnId: "201" },
      { index: 2, row: "2", column: "Mon", rowId: "101", columnId: "200" },
      { index: 3, row: "2", column: "Tue", rowId: "101", columnId: "201" },
    ]);
  });
});

describe("extractCreatedSlug", () => {
  it("reads the slug from the final URL", () => {
    expect(extractCreatedSlug("http://tap-py.com/abcd1234", "")).toBe("abcd1234");
  });

  it("falls back to a URL printed on the completion page", () => {
    const html = '<input type="text" value="http://tap-py.com/abcd1234">';
    expect(extractCreatedSlug("http://tap-py.com/create/done", html)).toBe("abcd1234");
  });
});
