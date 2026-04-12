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

export async function loadSVGFromStringCompat(svg: string): Promise<{ objects: any[]; options: any }> {
  const fn = NS.loadSVGFromString;
  if (typeof fn !== "function") {
    throw new Error("Fabric loadSVGFromString not available");
  }

  // Fabric v4/v5 style callback API.
  if (fn.length >= 2) {
    return new Promise((resolve, reject) => {
      try {
        fn(svg, (objects: any[], options: any) => resolve({ objects, options }));
      } catch (error) {
        reject(error);
      }
    });
  }

  // Fabric v6 style promise API.
  try {
    const result = fn(svg);
    if (result?.then) {
      const tuple = await result;
      if (Array.isArray(tuple)) {
        const [objects, options] = tuple;
        return { objects: objects ?? [], options: options ?? {} };
      }
      return result;
    }
  } catch {
    // Fallback to callback mode if runtime behaves unexpectedly.
  }

  return new Promise((resolve, reject) => {
    try {
      fn(svg, (objects: any[], options: any) => resolve({ objects, options }));
    } catch (error) {
      reject(error);
    }
  });
}

export function groupSVGElementsCompat(objects: any[], options: any) {
  const groupFn = NS?.util?.groupSVGElements;
  if (typeof groupFn === "function") {
    return groupFn(objects, options);
  }

  return new FabricCtors.Group(objects as any, options);
}

export async function createImageFromURLCompat(src: string): Promise<any> {
  const imageClass = FabricCtors.Image;
  if (!imageClass || typeof imageClass.fromURL !== "function") {
    throw new Error("Fabric image fromURL not available");
  }

  // Fabric v4/v5 callback API.
  if (imageClass.fromURL.length >= 2) {
    return new Promise((resolve, reject) => {
      try {
        imageClass.fromURL(src, (img: any) => resolve(img));
      } catch (error) {
        reject(error);
      }
    });
  }

  // Fabric v6 promise API.
  try {
    const result = imageClass.fromURL(src);
    if (result?.then) {
      return await result;
    }
  } catch {
    // Fallback to callback mode.
  }

  return new Promise((resolve, reject) => {
    try {
      imageClass.fromURL(src, (img: any) => resolve(img));
    } catch (error) {
      reject(error);
    }
  });
}
