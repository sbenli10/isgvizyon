import { describe, expect, it } from "vitest";
import { attachDeterministicClientIds, buildDeterministicClientId } from "@/lib/clientIdentity";

describe("clientIdentity", () => {
  it("builds the same id for the same normalized parts", () => {
    const first = buildDeterministicClientId("board-attendee", [" Ayse Kaya ", "12345678901"]);
    const second = buildDeterministicClientId("board-attendee", ["ayse kaya", "12345678901"]);

    expect(first).toBe(second);
    expect(first).toContain("board-attendee");
  });

  it("attaches stable ids that survive reordering", () => {
    const items = [
      { companyName: "ABC", taxNumber: "111", sgkNo: "SGK-1" },
      { companyName: "XYZ", taxNumber: "222", sgkNo: "SGK-2" },
    ];

    const firstPass = attachDeterministicClientIds(items, "osgb-company-import", (item) => [
      item.taxNumber,
      item.sgkNo,
      item.companyName,
    ]);
    const secondPass = attachDeterministicClientIds([...items].reverse(), "osgb-company-import", (item) => [
      item.taxNumber,
      item.sgkNo,
      item.companyName,
    ]);

    expect(firstPass.map((item) => item.client_id).sort()).toEqual(
      secondPass.map((item) => item.client_id).sort(),
    );
  });
});
