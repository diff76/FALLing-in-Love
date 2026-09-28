// 현장 참여 신청서 (수정용 Word) — A4 가로, 한 장에 8팀. Mirrors make_onsite_form.py (print PDF).
// Usage: node docs/forms/make_onsite_form.mjs <path-to-node_modules/docx> [pages]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  AlignmentType, BorderStyle, Document, HeightRule, ImageRun, Packer, PageOrientation, Paragraph,
  ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType, PageBreak,
} = require(process.argv[2] ?? "docx");

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGES = Number(process.argv[3] ?? 1);
const FONT = "NanumBarunGothic";
const mm = (v) => Math.round(v * 56.6929);           // DXA per mm
const INK = "2E251C", SOFT = "6B6154", RULE = "8C857A", ACCENT = "BE5637", HEAD_BG = "F3EADB", STAFF_BG = "E8E8E8";

// [header, width mm, prefill]
const COLS = [["No", 10], ["성함", 32], ["연락처", 50, "010 -            -"], ["VIP", 17], ["초청자", 17],
  ["함께 오신 분", 72], ["다음 초대장", 25, "받지 않음 □"], ["동의 서명", 36], ["입력", 14, "□"]];
const WIDTHS = COLS.map((c) => mm(c[1]));
const TABLE_W = WIDTHS.reduce((a, b) => a + b, 0);
const VIP = 3;
const ROWS = 8;

const run = (text, o = {}) => new TextRun({ text, font: { ascii: FONT, eastAsia: FONT, hAnsi: FONT }, size: Math.round((o.pt ?? 10) * 2), bold: !!o.bold, color: o.color ?? INK });
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], alignment: o.align ?? AlignmentType.LEFT, spacing: { before: o.before ?? 0, after: o.after ?? 0, line: o.line ?? 240 } });
const line = (color, size) => ({ style: BorderStyle.SINGLE, size, color });
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

function cell(text, i, o = {}) {
  const border = {
    top: o.top ?? line(RULE, 4), bottom: o.bottom ?? line(RULE, 4),
    left: i === VIP || i === VIP + 2 ? line(ACCENT, 12) : line(RULE, 4),
    right: i === VIP + 1 || i === VIP - 1 ? (i === VIP + 1 ? line(ACCENT, 12) : line(ACCENT, 12)) : line(RULE, 4),
  };
  if (i === 0) border.left = NONE;
  if (i === COLS.length - 1) border.right = NONE;
  const width = o.span ? WIDTHS[i] + WIDTHS[i + 1] : WIDTHS[i];
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, columnSpan: o.span ? 2 : undefined, rowSpan: o.rowSpan,
    verticalAlign: VerticalAlign.CENTER, borders: border,
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 0, bottom: 0, left: mm(1), right: mm(1) },
    children: Array.isArray(text) ? text : [para(run(text ?? "", o.run), { align: AlignmentType.CENTER })],
  });
}

function titleBlock() {
  const qr = readFileSync(join(HERE, "qr-apply.png"));
  const blank = (w) => run(" ".repeat(w), { pt: 10.5 });
  const leftW = TABLE_W - mm(62);
  const underline = (w) => new TextRun({ text: " ".repeat(w), underline: {}, font: { ascii: FONT, eastAsia: FONT, hAnsi: FONT }, size: 21 });
  const left = new TableCell({
    width: { size: leftW, type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, verticalAlign: VerticalAlign.BOTTOM,
    children: [
      para(run("2026 온출전 FALLing in Love", { pt: 11, color: SOFT }), { after: 60 }),
      para([run("현장 참여 신청서", { pt: 22, bold: true }), blank(6),
        run("작성 장소 ", { pt: 10.5, color: SOFT }), underline(26), blank(4),
        run("담당 봉사자 ", { pt: 10.5, color: SOFT }), underline(22), blank(4),
        run("No. ", { pt: 10.5, color: SOFT }), underline(8), run(" / ", { pt: 10.5, color: SOFT }), underline(8)], { after: 120 }),
      para(run("한 줄에 한 팀씩 적어 주세요. 좌석은 체크인 때 한 팀이 나란히 앉도록 배정됩니다.", { pt: 10 }), { after: 40 }),
      para(run("처음 오신 분은 VIP 칸에, 함께 모시고 온 성도님은 초청자 칸에 O 표시해 주세요.", { pt: 10 }), { after: 80 }),
    ],
  });
  const caption = new TableCell({
    width: { size: mm(34), type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, verticalAlign: VerticalAlign.CENTER,
    children: [
      para(run("휴대폰 카메라로 찍으면", { pt: 9, color: SOFT }), { align: AlignmentType.RIGHT }),
      para(run("온라인으로 바로", { pt: 9, color: SOFT }), { align: AlignmentType.RIGHT }),
      para(run("신청하실 수 있습니다", { pt: 9, bold: true, color: ACCENT }), { align: AlignmentType.RIGHT }),
    ],
  });
  const qrCell = new TableCell({
    width: { size: mm(28), type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, verticalAlign: VerticalAlign.TOP,
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: qr, transformation: { width: 96, height: 96 } })] }),
      para(run("falling.eventgo.kr/apply", { pt: 7, color: SOFT }), { align: AlignmentType.CENTER }),
    ],
  });
  return new Table({
    width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [leftW, mm(34), mm(28)], layout: TableLayoutType.FIXED,
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
    rows: [new TableRow({ children: [left, caption, qrCell] })],
  });
}

function formTable() {
  const heavy = line(INK, 18);
  const head1 = new TableRow({
    tableHeader: true, height: { value: mm(7), rule: HeightRule.EXACT },
    children: COLS.map(([label], i) => {
      if (i === VIP) return cell("VIP / 초청자 (O 체크)", i, { span: true, fill: HEAD_BG, top: heavy, run: { pt: 9, bold: true } });
      if (i === VIP + 1) return null;
      const content = i === COLS.length - 1
        ? [para(run("입력", { pt: 9, bold: true }), { align: AlignmentType.CENTER }), para(run("(봉사자)", { pt: 7, color: SOFT }), { align: AlignmentType.CENTER })]
        : label;
      return cell(content, i, { rowSpan: 2, fill: HEAD_BG, top: heavy, run: { pt: 10, bold: true } });
    }).filter(Boolean),
  });
  const head2 = new TableRow({
    tableHeader: true, height: { value: mm(7), rule: HeightRule.EXACT },
    children: [cell("VIP", VIP, { fill: HEAD_BG, run: { pt: 10, bold: true } }), cell("초청자", VIP + 1, { fill: HEAD_BG, run: { pt: 10, bold: true } })],
  });
  const body = Array.from({ length: ROWS }, (_, r) => new TableRow({
    height: { value: mm(15.5), rule: HeightRule.EXACT }, cantSplit: true,
    children: COLS.map(([, , pre], i) => cell(i === 0 ? String(r + 1) : pre ?? "", i, {
      bottom: r === ROWS - 1 ? heavy : undefined,
      fill: i === COLS.length - 1 ? STAFF_BG : undefined,
      run: { pt: pre === "□" ? 11 : i === 0 ? 10 : 9.5, color: SOFT },
    })),
  }));
  return new Table({
    width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: WIDTHS, layout: TableLayoutType.FIXED,
    rows: [head1, head2, ...body],
  });
}

const footer = () => [
  para(run("개인정보 수집·이용 동의: 좌석 배정과 행사 안내를 위해 성함과 연락처를 받으며, 행사 후 30일 안에 삭제합니다. 대표자 서명으로 동의를 확인합니다.", { pt: 8.3, color: SOFT }), { before: 140, after: 40 }),
  para(run("행사 후 그날의 플레이리스트와 사진은 신청하신 모든 분께 보내드립니다. 다음에 좋은 자리가 생기면 초대장도 전해드리려 하니, 원치 않으시면 '받지 않음'에 체크해 주세요.", { pt: 8.3, color: SOFT }), { after: 60 }),
  para(run("입력 칸은 봉사자가 운영앱 '엑셀 일괄 등록'에 옮겨 적은 뒤 체크합니다.   ·   FALLing in Love · 2026. 10. 11. 한신성전 Chapel & Garden", { pt: 7.5, color: SOFT })),
];

const children = [];
for (let p = 0; p < PAGES; p++) {
  if (p) children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(titleBlock(), formTable(), ...footer());
}
const doc = new Document({
  creator: "창동염광교회", title: "2026 온출전 FALLing in Love · 현장 참여 신청서",
  styles: { default: { document: { run: { font: { ascii: FONT, eastAsia: FONT, hAnsi: FONT }, size: 20 } } } },
  sections: [{
    properties: { page: { size: { width: mm(210), height: mm(297), orientation: PageOrientation.LANDSCAPE }, margin: { top: mm(10), bottom: mm(8), left: mm(12), right: mm(12) } } },
    children,
  }],
});
const out = join(HERE, "현장참여신청서.docx");
writeFileSync(out, await Packer.toBuffer(doc));
console.log(out);
