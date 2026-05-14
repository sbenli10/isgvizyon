import * as FabricModule from "fabric";

const NS: any = (FabricModule as any).fabric ?? (FabricModule as any);

export const Fabric = NS;

export const FabricCtors = {
  Canvas: NS.Canvas,
  IText: NS.IText,
  Line: NS.Line,
  Rect: NS.Rect,
  Circle: NS.Circle,
  Polyline: NS.Polyline,
  Triangle: NS.Triangle,
  Group: NS.Group,
  Image: NS.Image ?? NS.FabricImage,
};

type LoadedSvgResult = {
  objects: any[];
  options: Record<string, any>;
};

const normalizeLoadedSvgResult = (result: any): LoadedSvgResult => {
  if (!result) {
    return { objects: [], options: {} };
  }

  if (Array.isArray(result)) {
    return {
      objects: Array.isArray(result[0]) ? result[0].filter(Boolean) : [],
      options: result[1] ?? {},
    };
  }

  if (typeof result === "object") {
    return {
      objects: Array.isArray(result.objects) ? result.objects.filter(Boolean) : [],
      options: result.options ?? {},
    };
  }

  return { objects: [], options: {} };
};

const svgTextCache = new Map<string, string>();

export async function fetchSVGTextCompat(url: string): Promise<string> {
  if (!url || typeof url !== "string") {
    throw new Error("SVG URL geçersiz.");
  }

  const cached = svgTextCache.get(url);
  if (cached) return cached;

  const response = await fetch(url, {
    method: "GET",
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`SVG yüklenemedi: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();

  if (!text.includes("<svg")) {
    throw new Error("URL geçerli SVG içeriği döndürmedi.");
  }

  svgTextCache.set(url, text);
  return text;
}

/**
 * Fabric v5.5.x uyumlu güvenli SVG string yükleyici.
 *
 * Fabric v5 signature:
 *   fabric.loadSVGFromString(svgString, callback, reviver?)
 *
 * callback:
 *   (objects, options) => void
 *
 * Fabric v6+ bazı build'lerde Promise döndürebilir. Bu wrapper v5'i birincil
 * kabul eder, Promise dönüşü varsa da sonucu aynı forma normalize eder.
 */
export async function loadSVGFromStringCompat(svg: string): Promise<LoadedSvgResult> {
  const fn = NS.loadSVGFromString;

  if (typeof fn !== "function") {
    throw new Error("Fabric loadSVGFromString fonksiyonuna erişilemedi.");
  }

  if (typeof svg !== "string" || !svg.trim()) {
    throw new Error("SVG içeriği boş veya geçersiz.");
  }

  return new Promise<LoadedSvgResult>((resolve, reject) => {
    let settled = false;

    const safeResolve = (objects: any[] = [], options: Record<string, any> = {}) => {
      if (settled) return;
      settled = true;
      resolve({
        objects: Array.isArray(objects) ? objects.filter(Boolean) : [],
        options: options ?? {},
      });
    };

    const safeReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    try {
      /**
       * IMPORTANT:
       * Do not pass options as the second argument.
       * In Fabric v5, the second argument MUST be callback.
       */
      const maybePromise = fn.call(
        NS,
        svg,
        (objects: any[], options: Record<string, any>) => {
          safeResolve(objects, options);
        },
      );

      /**
       * Some Fabric v6 / ESM builds return a Promise. In Fabric v5 this is
       * usually undefined, so this branch is inert.
       */
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then((resolved: any) => {
            const normalized = normalizeLoadedSvgResult(resolved);
            safeResolve(normalized.objects, normalized.options);
          })
          .catch(safeReject);
      }
    } catch (error) {
      safeReject(error);
    }
  });
}

/**
 * Fabric SVG parser output'unu tek bir canvas objesine dönüştürür.
 *
 * Fabric util.groupSVGElements(elements, options) SVG viewBox/width/height
 * bilgisini options üzerinden kullanır. Bu nedenle options kaybedilmemelidir.
 */
export function groupSVGElementsCompat(objects: any[] = [], options: Record<string, any> = {}) {
  const cleanObjects = objects.filter(Boolean);

  if (cleanObjects.length === 0) {
    throw new Error("SVG parse edildi ancak Fabric objesi üretilemedi.");
  }

  if (cleanObjects.length === 1) {
    const onlyObject = cleanObjects[0];

    if (options && typeof onlyObject.set === "function") {
      onlyObject.set({
        ...options,
        originX: onlyObject.originX ?? "center",
        originY: onlyObject.originY ?? "center",
      });
    }

    return onlyObject;
  }

  const groupFn = NS?.util?.groupSVGElements;

  if (typeof groupFn === "function") {
    return groupFn(cleanObjects, {
      ...options,
      originX: "center",
      originY: "center",
    });
  }

  if (!FabricCtors.Group) {
    throw new Error("Fabric Group sınıfı kütüphanede bulunamadı.");
  }

  return new FabricCtors.Group(cleanObjects, {
    ...options,
    originX: "center",
    originY: "center",
  });
}

/**
 * Fabric v5/v6 uyumlu görsel yükleme katmanı.
 */
export async function createImageFromURLCompat(src: string): Promise<any> {
  const imageClass = FabricCtors.Image;

  if (!imageClass || typeof imageClass.fromURL !== "function") {
    throw new Error("Fabric Image sınıfı kütüphanede bulunamadı.");
  }

  if (typeof src !== "string" || !src.trim()) {
    throw new Error("Görsel kaynağı boş veya geçersiz.");
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const safeResolve = (img: any) => {
      if (settled) return;
      settled = true;

      if (!img) {
        reject(new Error("Fabric görsel nesnesini oluşturamadı."));
        return;
      }

      resolve(img);
    };

    const safeReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    try {
      const maybePromise = imageClass.fromURL(
        src,
        (img: any) => {
          safeResolve(img);
        },
        { crossOrigin: "anonymous" },
      );

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(safeResolve).catch(safeReject);
      }
    } catch (error) {
      safeReject(error);
    }
  });
}