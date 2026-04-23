import { describe, expect, it } from "vitest";
import { getBulkCompanyPreviewKey, getParsedEmployeePreviewKey } from "@/lib/companyManagerKeys";

describe("company manager stable preview keys", () => {
  it("uses immutable employee identifiers instead of index order", () => {
    const first = {
      full_name: "Ayşe Kaya",
      first_name: "Ayşe",
      last_name: "Kaya",
      tc_number: "12345678901",
      email: "ayse@example.com",
      start_date: "2026-04-23",
    };

    const second = {
      full_name: "Mehmet Demir",
      first_name: "Mehmet",
      last_name: "Demir",
      tc_number: "10987654321",
      email: "mehmet@example.com",
      start_date: "2026-04-23",
    };

    const keysInOriginalOrder = [first, second].map((item) => getParsedEmployeePreviewKey(item as any));
    const keysInReversedOrder = [second, first].map((item) => getParsedEmployeePreviewKey(item as any));

    expect(keysInOriginalOrder.sort()).toEqual(keysInReversedOrder.sort());
    expect(keysInOriginalOrder).toContain("12345678901");
    expect(keysInOriginalOrder).toContain("10987654321");
  });

  it("uses stable bulk company identifiers instead of derived index keys", () => {
    const row = {
      company_name: "ABC Sanayi",
      tax_number: "9988776655",
      nace_code: "25.11.01",
      email: "info@abc.com",
    };

    const keyFirstRender = getBulkCompanyPreviewKey(row);
    const keySecondRender = getBulkCompanyPreviewKey({ ...row });

    expect(keyFirstRender).toBe(keySecondRender);
    expect(keyFirstRender).toContain("9988776655");
    expect(keyFirstRender).not.toContain("index");
  });
});
