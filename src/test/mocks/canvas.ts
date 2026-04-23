export class CanvasRenderingContext2D {}

export const createCanvas = () => ({
  getContext: () => ({}),
  toBuffer: () => Buffer.from([]),
});

export default {
  createCanvas,
  CanvasRenderingContext2D,
};
