import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { answerBoard, buildAnswerBody, createBoard, showBoard } from "../src/client/api.js";
import { TappyHttp, type FetchLike } from "../src/client/http.js";
import { parseRegisterForm } from "../src/client/parse.js";

const boardHtml = readFileSync(new URL("./fixtures/board.html", import.meta.url), "utf8");
const registerHtml = readFileSync(new URL("./fixtures/register.html", import.meta.url), "utf8");

function response(body: string, status: number, headers?: Headers): Response {
  return new Response(body, { status, headers });
}

describe("TappyHttp", () => {
  it("keeps cookies across a redirect", async () => {
    const seen: string[] = [];
    const fetchImpl: FetchLike = async (input, init) => {
      const url = String(input);
      seen.push(`${init?.method ?? "GET"} ${url} cookie=${(init?.headers as Record<string, string>).cookie ?? ""}`);
      if (url.endsWith("/create") && init?.method === "POST") {
        const headers = new Headers();
        headers.append("location", "/abcd1234");
        headers.append("set-cookie", "tappy=session; path=/; HttpOnly");
        return response("", 302, headers);
      }
      return response(boardHtml, 200);
    };

    const http = new TappyHttp("http://tap-py.com/", fetchImpl);
    const created = await createBoard(http, {
      subject: "勉強会",
      description: "詳細",
      rows: ["1"],
      columns: ["Mon"],
    });
    expect(created).toEqual({ slug: "abcd1234", url: "http://tap-py.com/abcd1234" });
    expect(seen.some((line) => line.startsWith("GET") && line.includes("cookie=tappy=session"))).toBe(true);
  });
});

describe("showBoard", () => {
  it("parses the event page", async () => {
    const fetchImpl: FetchLike = async () => response(boardHtml, 200);
    const board = await showBoard(
      new TappyHttp("http://tap-py.com", fetchImpl),
      "http://tap-py.com/abcd1234/register",
    );
    expect(board.slug).toBe("abcd1234");
    expect(board.rows[0]?.cells[0]?.count).toBe(2);
  });
});

describe("buildAnswerBody", () => {
  it("sends is_valied=1 only for selected cells, after the hidden 0", () => {
    const slots = parseRegisterForm(registerHtml);
    const body = buildAnswerBody(slots, new Set(["1\0Mon"]), {
      name: "Alice",
      comment: "いけます",
    });
    const text = body.toString();
    expect(text).toContain("data%5BAttendance%5D%5B0%5D%5Bis_valied%5D=0");
    expect(text).toContain("data%5BAttendance%5D%5B0%5D%5Bis_valied%5D=1");
    expect(text).not.toMatch(/data%5BAttendance%5D%5B1%5D%5Bis_valied%5D=1/);
    expect(body.get("data[Member][name]")).toBe("Alice");
    expect(body.get("data[Comment][body]")).toBe("いけます");
  });
});

describe("answerBoard", () => {
  it("posts the register form and reloads the board", async () => {
    let posted = "";
    const fetchImpl: FetchLike = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/register") && init?.method === "POST") {
        posted = String(init.body);
        return response("", 302, new Headers({ location: "/abcd1234" }));
      }
      if (url.endsWith("/register")) return response(registerHtml, 200);
      return response(boardHtml, 200);
    };
    const board = await answerBoard(new TappyHttp("http://tap-py.com", fetchImpl), "abcd1234", {
      name: "Alice",
      cells: [{ row: "1", column: "Mon" }],
    });
    expect(posted).toContain("is_valied%5D=1");
    expect(board.title).toBe("勉強会");
  });

  it("lists known labels when a cell does not exist", async () => {
    const fetchImpl: FetchLike = async () => response(registerHtml, 200);
    await expect(
      answerBoard(new TappyHttp("http://tap-py.com", fetchImpl), "abcd1234", {
        name: "Alice",
        cells: [{ row: "9", column: "Fri" }],
      }),
    ).rejects.toThrow(/不明なマスです: 9,Fri[\s\S]*行: 1, 2[\s\S]*列: Mon, Tue/);
  });
});
