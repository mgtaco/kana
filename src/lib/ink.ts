/**
 * How much blank space sits either side of an element's rendered text: the
 * font's side bearings plus any horizontal padding.
 *
 * A kana glyph is drawn inside a roughly square em box and carries far more
 * side bearing than Latin letters do. Centring a kana and its rōmaji by their
 * layout boxes therefore leaves the *ink* visibly off centre. Feeding these
 * numbers back as negative margins makes each box hug its ink, after which
 * ordinary flex centring lines the ink up as well.
 *
 * The ink extents are found by drawing the text offscreen and scanning for the
 * first and last columns that contain any pixels. `TextMetrics` exposes
 * `actualBoundingBoxLeft`/`Right`, which would be cheaper, but browsers have
 * disagreed on their sign convention — reading the pixels back cannot be
 * misinterpreted.
 */

export interface Bearings {
  left: number;
  right: number;
}

export const NO_BEARINGS: Bearings = { left: 0, right: 0 };

/** Drawn at 2× so the scan resolves to half a CSS pixel. */
const SCALE = 2;
/** Blank margin around the text, so ink can never touch the canvas edge. */
const PAD = 8;

let surface: HTMLCanvasElement | null = null;

function scratch(): CanvasRenderingContext2D | null {
  surface ??= document.createElement('canvas');
  return surface.getContext('2d', { willReadFrequently: true });
}

/**
 * Canvas font parsers are stricter than CSS: a shorthand they reject is
 * ignored outright, silently leaving the previous font in place and making
 * every measurement wrong. Weights are rounded to a hundred, everything
 * optional is dropped, and a weightless variant is offered as a fallback —
 * `inkBearings` picks whichever actually reproduces the browser's own layout.
 */
function candidateFonts(style: CSSStyleDeclaration, sizePx: number): string[] {
  const raw = parseFloat(style.fontWeight);
  const weight = Math.min(900, Math.max(100, Math.round((raw || 400) / 100) * 100));
  return [`${weight} ${sizePx}px ${style.fontFamily}`, `${sizePx}px ${style.fontFamily}`];
}

interface Extents {
  /** Distance from the text origin to the first inked column. */
  left: number;
  /** Distance from the text origin to just past the last inked column. */
  right: number;
  advance: number;
}

function inkExtents(text: string, font: string, sizePx: number, spacing: string): Extents | null {
  const ctx = scratch();
  if (!ctx) return null;

  const apply = () => {
    ctx.font = font;
    if ('letterSpacing' in ctx) ctx.letterSpacing = spacing;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  };

  apply();
  const advance = ctx.measureText(text).width;
  if (!Number.isFinite(advance) || advance <= 0) return null;

  const width = Math.ceil(advance) + PAD * 2;
  const height = Math.ceil(sizePx * 2.2);
  ctx.canvas.width = width;
  ctx.canvas.height = height;
  // Resizing the canvas resets every context property.
  apply();

  const baseline = Math.round(height * 0.75);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.fillText(text, PAD, baseline);

  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }

  let first = -1;
  let last = -1;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (pixels[(y * width + x) * 4 + 3] !== 0) {
        if (first < 0) first = x;
        last = x;
        break;
      }
    }
  }
  if (first < 0) return null;

  return { left: first - PAD, right: last + 1 - PAD, advance };
}

export function inkBearings(el: HTMLElement): Bearings {
  const text = (el.textContent ?? '').trim();
  if (!text) return NO_BEARINGS;

  const style = getComputedStyle(el);
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const padRight = parseFloat(style.paddingRight) || 0;
  // offsetWidth rather than a rect, so an in-flight transform can't skew it.
  const contentWidth = el.offsetWidth - padLeft - padRight;
  if (contentWidth <= 0) return NO_BEARINGS;

  const fontSize = parseFloat(style.fontSize);
  const spacing = parseFloat(style.letterSpacing);
  const tolerance = Math.max(4, contentWidth * 0.15);

  for (const font of candidateFonts(style, fontSize * SCALE)) {
    const extents = inkExtents(
      text,
      font,
      fontSize * SCALE,
      Number.isFinite(spacing) ? `${spacing * SCALE}px` : '0px',
    );
    if (!extents) continue;

    // Only trust a measurement that reproduces the width the browser itself
    // laid out — anything else means the canvas resolved a different font, and
    // trimming by those numbers would make the centring worse, not better.
    if (Math.abs(extents.advance / SCALE - contentWidth) > tolerance) continue;

    return {
      left: Math.max(0, padLeft + extents.left / SCALE),
      right: Math.max(0, padRight + contentWidth - extents.right / SCALE),
    };
  }

  // Nothing measured cleanly: leave the boxes untrimmed rather than guess.
  return NO_BEARINGS;
}
