/**
 * How much blank space sits either side of an element's rendered text: the
 * font's side bearings plus any horizontal padding.
 *
 * A kana glyph is drawn inside a roughly square em box and carries far more
 * side bearing than Latin letters do. Centring a kana and its rōmaji by their
 * layout boxes therefore leaves the *ink* visibly off centre. Feeding these
 * numbers back as negative margins makes each box hug its ink, after which
 * ordinary flex centring lines the ink up as well.
 */

export interface Bearings {
  left: number;
  right: number;
}

export const NO_BEARINGS: Bearings = { left: 0, right: 0 };

let cached: CanvasRenderingContext2D | null | undefined;

function measureContext(): CanvasRenderingContext2D | null {
  if (cached === undefined) cached = document.createElement('canvas').getContext('2d');
  return cached;
}

export function inkBearings(el: HTMLElement): Bearings {
  const text = el.textContent ?? '';
  const ctx = measureContext();
  if (!ctx || !text.trim()) return NO_BEARINGS;

  const style = getComputedStyle(el);
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  // Where supported, letter-spacing has to be matched or the advance width
  // drifts from what the browser actually laid out.
  const spacing = parseFloat(style.letterSpacing);
  if ('letterSpacing' in ctx && Number.isFinite(spacing)) {
    ctx.letterSpacing = `${spacing}px`;
  }

  const metrics = ctx.measureText(text);
  if (typeof metrics.actualBoundingBoxLeft !== 'number') return NO_BEARINGS;

  const padLeft = parseFloat(style.paddingLeft) || 0;
  const padRight = parseFloat(style.paddingRight) || 0;
  // offsetWidth rather than a rect, so an in-flight transform can't skew it.
  const contentWidth = el.offsetWidth - padLeft - padRight;

  return {
    left: Math.max(0, padLeft - metrics.actualBoundingBoxLeft),
    right: Math.max(0, padRight + contentWidth - metrics.actualBoundingBoxRight),
  };
}
