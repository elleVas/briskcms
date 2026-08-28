const AA_NORMAL_TEXT_RATIO = 4.5;

/**
 * Componenti sRGB LINEARI (non gamma-corretti) di un colore — esattamente
 * ciò che serve alla formula di luminanza relativa WCAG 2.1 (§1.4.3), che
 * pesa (0.2126, 0.7152, 0.0722) proprio i canali linear-light, non quelli
 * gamma-compressi che si vedono a schermo.
 */
interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

function srgbChannelToLinear(channel: number): number {
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * L'UNICO formato che il campo colore primario/secondario del tema può
 * mai avere in ingresso (`hexColorSchema` in shared-types) — l'utente
 * sceglie sempre da un `<input type="color">`.
 */
function parseHexToLinearRgb(hex: string): LinearRgb | null {
  const match = hex.match(/^#([0-9a-fA-F]{6})$/);
  if (!match) return null;
  const value = match[1];
  const [r, g, b] = [0, 2, 4].map(
    (offset) => parseInt(value.slice(offset, offset + 2), 16) / 255,
  );
  return {
    r: srgbChannelToLinear(r),
    g: srgbChannelToLinear(g),
    b: srgbChannelToLinear(b),
  };
}

/**
 * Il formato in cui il TEMA ATTIVO dichiara `--primary-foreground`/
 * `--secondary-foreground` oggi (vedi themes/classic/theme.css) — non un
 * parser CSS generico, solo questa forma specifica (`oklch(L C H)`,
 * niente alpha/unità percentuale). Conversione OKLCH -> OKLab -> LMS ->
 * sRGB lineare con le matrici pubblicate da Björn Ottosson
 * (https://bottosson.github.io/posts/oklab/) — gli stessi coefficienti
 * usati dal resto dell'ecosistema CSS Color 4 (browser, Culori, ecc.).
 * Si ferma alla sRGB LINEARE (non fa l'ultimo passo di gamma-encoding a
 * sRGB "da schermo"): la formula di luminanza WCAG sopra vuole proprio
 * quella, quindi il passo in più sarebbe calcolato solo per essere
 * decodificato di nuovo.
 */
function parseOklchToLinearRgb(color: string): LinearRgb | null {
  const match = color
    .trim()
    .match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i);
  if (!match) return null;
  const [, lStr, cStr, hStr] = match;
  const l = Number(lStr);
  const c = Number(cStr);
  const hueRadians = (Number(hStr) * Math.PI) / 180;

  const a = c * Math.cos(hueRadians);
  const b = c * Math.sin(hueRadians);

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;

  const lCubed = lPrime ** 3;
  const mCubed = mPrime ** 3;
  const sCubed = sPrime ** 3;

  return {
    r: 4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed,
    g: -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed,
    b: -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed,
  };
}

function parseColorToLinearRgb(color: string): LinearRgb | null {
  return parseHexToLinearRgb(color) ?? parseOklchToLinearRgb(color);
}

function relativeLuminance({ r, g, b }: LinearRgb): number {
  // OKLCH conversion can land slightly outside [0, 1] for an out-of-sRGB-
  // gamut color (harmless here — clamping keeps the luminance formula
  // physically meaningful instead of producing a nonsensical negative).
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel));
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
}

function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastCheckResult {
  passesAA: boolean;
  ratio: number;
}

/**
 * Confronta il colore scelto dall'utente (sempre hex) contro il token
 * `--primary-foreground`/`--secondary-foreground` RISOLTO del tema attivo
 * (oggi sempre oklch, vedi `resolve-theme-foreground-tokens.ts`) — non
 * contro un'assunzione fissa "bianco o nero": quel token è un valore
 * FISSO per tutto il tema, mai ricalcolato in base al colore scelto (a
 * differenza di, es., un tool che sceglie automaticamente testo chiaro/
 * scuro) — è esattamente per questo che una combinazione illeggibile è
 * possibile qui, e perché il confronto dev'essere contro il vero valore
 * del tema, non contro un'ipotesi.
 *
 * Ritorna `null` (nessun controllo, nessun avviso) se uno dei due colori
 * non è in un formato riconosciuto — non dovrebbe succedere in pratica
 * (entrambi vengono da fonti già validate), ma un tema custom incompleto
 * o un futuro formato diverso non deve rompere il salvataggio.
 */
export function checkContrastAgainstThemeForeground(
  backgroundHex: string,
  themeForegroundColor: string,
): ContrastCheckResult | null {
  const background = parseColorToLinearRgb(backgroundHex);
  const foreground = parseColorToLinearRgb(themeForegroundColor);
  if (!background || !foreground) return null;

  const ratio = contrastRatio(
    relativeLuminance(background),
    relativeLuminance(foreground),
  );
  return { passesAA: ratio >= AA_NORMAL_TEXT_RATIO, ratio };
}
