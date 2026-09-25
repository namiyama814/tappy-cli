import { describe, expect, it } from "vitest";
import { TappyError } from "../src/client/http.js";
import { calendarAxes, resolveAxes, timetableAxes } from "../src/templates.js";

const now = new Date(2026, 8, 26);

describe("timetableAxes", () => {
  it("builds weekday periods and optional lunch or weekend", () => {
    expect(timetableAxes({ periods: 2 })).toEqual({
      rows: ["1", "2"],
      columns: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    });
    expect(timetableAxes({ periods: 1, lunch: true, weekend: true })).toEqual({
      rows: ["1", "昼休み"],
      columns: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    });
  });

  it("rejects a period count outside 1-10", () => {
    expect(() => timetableAxes({ periods: 0 })).toThrow(TappyError);
    expect(() => timetableAxes({ periods: 11 })).toThrow(TappyError);
  });
});

describe("calendarAxes", () => {
  it("builds hourly rows and month/day columns", () => {
    expect(
      calendarAxes({ from: "9/30", days: 3, start: "09:00", end: "11:00", now }),
    ).toEqual({
      rows: ["09:00", "10:00", "11:00"],
      columns: ["9/30", "10/1", "10/2"],
    });
  });

  it("defaults the start date to today", () => {
    expect(calendarAxes({ days: 2, start: "9:00", end: "09:00", now }).columns).toEqual([
      "9/26",
      "9/27",
    ]);
  });

  it("rejects an end time before the start time", () => {
    expect(() => calendarAxes({ start: "17:00", end: "09:00", now })).toThrow(
      "終了時刻は開始時刻以降にしてください",
    );
  });
});

describe("resolveAxes", () => {
  const base = {
    timetable: false,
    calendar: false,
    periods: 5,
    lunch: false,
    weekend: false,
    days: 5,
    start: "09:00",
    end: "17:00",
    rows: [] as string[],
    columns: [] as string[],
    now,
  };

  it("lets explicit labels replace a template axis", () => {
    expect(
      resolveAxes({ ...base, timetable: true, periods: 5, rows: ["午前", "午後"] }).rows,
    ).toEqual(["午前", "午後"]);
  });

  it("requires a template or both axes", () => {
    expect(() => resolveAxes(base)).toThrow(/--timetable/);
    expect(() => resolveAxes({ ...base, timetable: true, calendar: true })).toThrow(
      "同時に指定できません",
    );
  });
});
