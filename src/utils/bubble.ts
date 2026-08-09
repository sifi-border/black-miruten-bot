const TOP_LEFT = "╭";
const TOP_RIGHT = "╮";
const BOTTOM_LEFT = "╰";
const BOTTOM_RIGHT = "╯";
const BORDER_CHAR = "━";
const BOTTOM_MARKER = "ｖ";
const LEADING_SPACE = "　";

/** ｖを固定する、罫線内での目安位置(先頭 ━ の本数) */
const BOTTOM_MARKER_OFFSET = 6;

/** 罫線の最低本数。極端に短い/空のmessageでも箱として成立させるための下限 */
const MIN_BORDER_WIDTH = 1;

// Unicode East Asian Width の Fullwidth(F) / Wide(W) に相当する主要レンジ。
// 該当すれば表示幅2、それ以外は1として扱う。
const WIDE_RANGES: Array<[number, number]> = [
  [0x1100, 0x115f], // Hangul Jamo
  [0x2e80, 0x303e], // CJK 部首・記号
  [0x3041, 0x33ff], // ひらがな〜CJK互換
  [0x3400, 0x4dbf], // CJK拡張A
  [0x4e00, 0x9fff], // CJK統合漢字
  [0xa000, 0xa4cf], // イ文字
  [0xac00, 0xd7a3], // ハングル音節
  [0xf900, 0xfaff], // CJK互換漢字
  [0xfe30, 0xfe4f], // CJK互換形
  [0xff00, 0xff60], // 全角形
  [0xffe0, 0xffe6],
  [0x20000, 0x3fffd], // CJK拡張B以降
];

// 結合文字・異体字セレクタなど、表示幅を持たない(0扱いの)コードポイント帯
const ZERO_WIDTH_RANGES: Array<[number, number]> = [
  [0x0300, 0x036f], // 結合分音記号
  [0x180b, 0x180d], // モンゴル文字可変セレクタ
  [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff],
  [0x200b, 0x200f], // ゼロ幅スペース等
  [0x20d0, 0x20ff],
  [0xfe00, 0xfe0f], // 異体字セレクタ (VS1-16)
  [0xfe20, 0xfe2f],
];

function isInRanges(codePoint: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => codePoint >= start && codePoint <= end);
}

function getCharDisplayWidth(codePoint: number): number {
  if (isInRanges(codePoint, ZERO_WIDTH_RANGES)) return 0;
  if (isInRanges(codePoint, WIDE_RANGES)) return 2;
  return 1;
}

/** 全角=2、半角=1として文字列の表示幅を計算する */
export function getDisplayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += getCharDisplayWidth(char.codePointAt(0)!);
  }
  return width;
}

function buildTopBorder(dashCount: number): string {
  return TOP_LEFT + BORDER_CHAR.repeat(dashCount) + TOP_RIGHT;
}

function buildBottomBorder(dashCount: number): string {
  // v は「先頭からBOTTOM_MARKER_OFFSET本目」を目安に固定位置とする。
  // 罫線幅がその位置より短い極端なケースでは、収まる範囲に丸める。
  const totalMiddleSlots = Math.max(dashCount, 1);
  const before = Math.min(BOTTOM_MARKER_OFFSET, Math.max(totalMiddleSlots - 1, 0));
  const after = Math.max(totalMiddleSlots - 1 - before, 0);
  return (
    BOTTOM_LEFT +
    BORDER_CHAR.repeat(before) +
    BOTTOM_MARKER +
    BORDER_CHAR.repeat(after) +
    BOTTOM_RIGHT
  );
}

/**
 * メッセージを罫線囲みの吹き出しテキストに整形する。
 * 改行を含む場合は各行の表示幅の最大値に罫線幅を合わせる。
 * 他のコマンドからも再利用できるよう、Discord固有の処理は含めない。
 */
export function buildBubbleText(message: string): string {
  const lines = message.split("\n");
  const contentWidth = Math.max(...lines.map(getDisplayWidth));
  const dashCount = Math.max(MIN_BORDER_WIDTH, contentWidth - 2);

  const top = buildTopBorder(dashCount);
  const body = lines.map((line) => LEADING_SPACE + line).join("\n");
  const bottom = buildBottomBorder(dashCount);

  return [top, body, bottom].join("\n");
}
