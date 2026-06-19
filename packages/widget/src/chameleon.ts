interface ColorScheme {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  accent: string;
  userBubble: string;
  inputFocus: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6 && clean.length !== 3) return null;

  const full = clean.length === 3
    ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
    : clean;

  const num = parseInt(full, 16);
  if (isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}

function adjustBrightness(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255];
  const linearize = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function isLight(hex: string): boolean {
  return getLuminance(hex) > 0.5;
}

function getDominantColors(imageData: ImageData, sampleCount: number = 5): string[] {
  const data = imageData.data;
  const colorBuckets: Map<string, { count: number; r: number; g: number; b: number }> = new Map();

  const step = Math.max(1, Math.floor(data.length / (sampleCount * 100)));

  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue;

    // Quantize to reduce noise
    const qr = Math.round(r / 16) * 16;
    const qg = Math.round(g / 16) * 16;
    const qb = Math.round(b / 16) * 16;
    const key = `${qr},${qg},${qb}`;

    const existing = colorBuckets.get(key);
    if (existing) {
      existing.count++;
      existing.r += r;
      existing.g += g;
      existing.b += b;
    } else {
      colorBuckets.set(key, { count: 1, r, g, b });
    }
  }

  const sorted = Array.from(colorBuckets.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, sampleCount);

  return sorted.map(([, value]) => {
    const r = Math.round(value.r / value.count);
    const g = Math.round(value.g / value.count);
    const b = Math.round(value.b / value.count);
    return rgbToHex(r, g, b);
  });
}

export async function extractColorsFromLogo(imgUrl: string): Promise<{
  primary: string;
  isLight: boolean;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ primary: '#B8860B', isLight: true });
          return;
        }

        const maxSize = 200;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colors = getDominantColors(imageData);

        if (colors.length === 0) {
          resolve({ primary: '#B8860B', isLight: true });
          return;
        }

        // Filter out very light (near white) and very dark (near black) colors
        const filtered = colors.filter((c) => {
          const rgb = hexToRgb(c);
          if (!rgb) return false;
          const total = rgb.r + rgb.g + rgb.b;
          return total > 100 && total < 700;
        });

        const primary = filtered.length > 0 ? filtered[0] : colors[0];
        const light = isLight(primary);

        resolve({ primary, isLight: light });
      } catch {
        resolve({ primary: '#B8860B', isLight: true });
      }
    };

    img.onerror = () => {
      resolve({ primary: '#B8860B', isLight: true });
    };

    img.src = imgUrl;
  });
}

export function generateColorScheme(primaryColor: string, theme: 'light' | 'dark'): ColorScheme {
  const light = isLight(primaryColor);

  return {
    primary: primaryColor,
    primaryHover: light ? adjustBrightness(primaryColor, 0.85) : adjustBrightness(primaryColor, 1.15),
    primaryLight: hexToRgba(primaryColor, 0.12),
    accent: theme === 'dark' ? '#ffffff' : '#1a1a2e',
    userBubble: primaryColor,
    inputFocus: primaryColor,
  };
}

export function applyTheme(shadowRoot: ShadowRoot, colors: ColorScheme, theme: 'light' | 'dark'): void {
  const host = shadowRoot.host as HTMLElement;
  host.style.setProperty('--widget-primary', colors.primary);
  host.style.setProperty('--widget-primary-hover', colors.primaryHover);
  host.style.setProperty('--widget-primary-light', colors.primaryLight);
  host.style.setProperty('--widget-user-bubble', colors.userBubble);
  host.style.setProperty('--widget-input-focus', colors.inputFocus);

  if (theme === 'dark') {
    host.classList.add('chatai-theme-dark');
  } else {
    host.classList.remove('chatai-theme-dark');
  }
}
