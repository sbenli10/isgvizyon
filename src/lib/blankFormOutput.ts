export const emptyLine = "______________________";
export const emptyLongLine = "....................................................................";
export const emptyDate = "____ / ____ / ______";

export const valueOrBlank = (value?: string | number | null, fallback = emptyLine) => {
  if (typeof value === "number" && !Number.isFinite(value)) {
    return fallback;
  }

  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }

  return String(value);
};

export const dateOrBlank = (value?: string | Date | null) => {
  if (!value) return emptyDate;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).trim() || emptyDate;

  return parsed.toLocaleDateString("tr-TR");
};

export const safeFilePart = (value?: string | number | null, fallback = "bos-form") =>
  valueOrBlank(value, fallback)
    .replace(/_/g, "-")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^-|-$/g, "") || fallback;
