import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  mergeMissingFormValues,
  usePersistentFormDraft,
} from "@/hooks/usePersistentFormDraft";

type DemoValue = {
  firmName: string;
  note: string;
};

const initialValue: DemoValue = {
  firmName: "",
  note: "",
};

function DemoForm({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string;
}) {
  const [value, setValue] = useState<DemoValue>(initialValue);
  const { markSubmitted, mergeDefaults } = usePersistentFormDraft({
    formId: "demo-form",
    value,
    initialValue,
    userId,
    organizationId,
    enabled: true,
    debounceMs: 0,
    onRestore: (draft) => setValue(draft),
    isDirty: Boolean(value.firmName || value.note),
    debugLabel: "DemoForm",
  });

  return (
    <div>
      <input
        aria-label="Firma"
        value={value.firmName}
        onChange={(event) =>
          setValue((prev) => ({ ...prev, firmName: event.target.value }))
        }
      />
      <textarea
        aria-label="Not"
        value={value.note}
        onChange={(event) =>
          setValue((prev) => ({ ...prev, note: event.target.value }))
        }
      />
      <button
        type="button"
        onClick={() =>
          setValue((prev) =>
            mergeDefaults({
              firmName: "Varsayılan Firma",
              note: "Varsayılan not",
            }),
          )
        }
      >
        Varsayılan uygula
      </button>
      <button
        type="button"
        onClick={async () => {
          await markSubmitted();
          setValue(initialValue);
        }}
      >
        Submit
      </button>
    </div>
  );
}

describe("usePersistentFormDraft", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("restores draft after remount", async () => {
    const view = render(
      <MemoryRouter initialEntries={["/demo"]}>
        <DemoForm userId="u1" organizationId="o1" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Firma"), {
      target: { value: "Aslan İnşaat" },
    });

    await waitFor(() => {
      expect(window.localStorage.length).toBeGreaterThan(0);
    });

    view.unmount();

    render(
      <MemoryRouter initialEntries={["/demo"]}>
        <DemoForm userId="u1" organizationId="o1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Firma")).toHaveValue("Aslan İnşaat");
    });
  });

  it("does not overwrite restored values with defaults", async () => {
    render(
      <MemoryRouter initialEntries={["/demo"]}>
        <DemoForm userId="u1" organizationId="o1" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Firma"), {
      target: { value: "Özel Firma" },
    });

    await waitFor(() => {
      expect(window.localStorage.length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Varsayılan uygula" }));

    expect(screen.getByLabelText("Firma")).toHaveValue("Özel Firma");
    expect(screen.getByLabelText("Not")).toHaveValue("Varsayılan not");
  });

  it("clears draft after successful submit", async () => {
    const view = render(
      <MemoryRouter initialEntries={["/demo"]}>
        <DemoForm userId="u1" organizationId="o1" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Firma"), {
      target: { value: "Silinecek Taslak" },
    });

    await waitFor(() => {
      expect(window.localStorage.length).toBeGreaterThan(0);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    });

    view.unmount();

    render(
      <MemoryRouter initialEntries={["/demo"]}>
        <DemoForm userId="u1" organizationId="o1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Firma")).toHaveValue("");
    });
  });

  it("keeps user and organization drafts isolated", async () => {
    const view = render(
      <MemoryRouter initialEntries={["/demo"]}>
        <DemoForm userId="u1" organizationId="o1" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Firma"), {
      target: { value: "Scope 1" },
    });

    await waitFor(() => {
      expect(window.localStorage.length).toBeGreaterThan(0);
    });

    view.unmount();

    render(
      <MemoryRouter initialEntries={["/demo"]}>
        <DemoForm userId="u2" organizationId="o2" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Firma")).toHaveValue("");
    });
  });

  it("mergeMissingFormValues keeps existing values and fills only empty ones", () => {
    expect(
      mergeMissingFormValues(
        { firmName: "Korunan", note: "" },
        { firmName: "Varsayılan", note: "Dolduruldu" },
      ),
    ).toEqual({
      firmName: "Korunan",
      note: "Dolduruldu",
    });
  });
});
