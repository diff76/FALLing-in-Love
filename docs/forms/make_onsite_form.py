"""현장 참여 신청서 (인쇄용 PDF) — A4 가로, 한 장에 8팀.

Usage: python3 docs/forms/make_onsite_form.py [pages]
Writes docs/forms/현장참여신청서.pdf next to this script. Layout mirrors make_onsite_form.mjs
(the editable .docx); change both when the columns change.
"""
import sys
from pathlib import Path
import pymupdf as fitz

HERE = Path(__file__).resolve().parent
OUT = HERE / "현장참여신청서.pdf"
QR = HERE / "qr-apply.png"
PAGES = int(sys.argv[1]) if len(sys.argv) > 1 else 1
FONT_R, FONT_B = "/Library/Fonts/NanumBarunGothic.ttf", "/Library/Fonts/NanumBarunGothicBold.ttf"

MM = 72 / 25.4
W, H = 297 * MM, 210 * MM
M = 12 * MM                                   # page margin
INK, SOFT, RULE = (0.18, 0.15, 0.11), (0.42, 0.38, 0.33), (0.55, 0.52, 0.48)
ACCENT = (0.745, 0.337, 0.216)               # persimmon #BE5637
HEAD_BG, STAFF_BG = (0.953, 0.918, 0.859), (0.90, 0.90, 0.90)

# (header, width mm, prefilled text, align) — VIP/초청자 share one grouped header
COLS = [
    ("No", 10, None, "c"),
    ("성함", 32, None, "c"),
    ("연락처", 50, "010 -            -", "c"),
    ("VIP", 17, None, "c"),
    ("초청자", 17, None, "c"),
    ("함께 오신 분", 72, None, "c"),
    ("다음 초대장", 25, "받지 않음 □", "c"),
    ("동의 서명", 36, None, "c"),
    ("입력", 14, "□", "c"),
]
assert abs(sum(c[1] for c in COLS) - 273) < 0.01, sum(c[1] for c in COLS)
ROWS = 8


def text(page, x, y, s, size, bold=False, color=INK, align="l", w=None):
    """Draw one line with its baseline at y. align l/c/r within [x, x+w]."""
    font = "B" if bold else "R"
    tw = page_fonts[font].text_length(s, fontsize=size)
    if align == "c" and w is not None: x = x + (w - tw) / 2
    elif align == "r" and w is not None: x = x + w - tw
    page.insert_text((x, y), s, fontname=font, fontsize=size, color=color)


def build(doc):
    page = doc.new_page(width=W, height=H)
    page.insert_font(fontname="R", fontfile=FONT_R)
    page.insert_font(fontname="B", fontfile=FONT_B)

    # ---------- title block ----------
    qr_size = 27 * MM
    qr_x, qr_y = W - M - qr_size, M - 2 * MM
    top = M + 7 * MM
    text(page, M, top, "2026 온출전 FALLing in Love", 11, color=SOFT)
    text(page, M, top + 11 * MM, "현장 참여 신청서", 22, bold=True, color=INK)
    tx = M + page_fonts["B"].text_length("현장 참여 신청서", fontsize=22) + 8 * MM
    fields = [("작성 장소", 34), ("담당 봉사자", 30), ("No.", 16)]
    fx = tx
    for label, lw in fields:
        text(page, fx, top + 11 * MM, label, 10.5, color=SOFT)
        lx = fx + page_fonts["R"].text_length(label, fontsize=10.5) + 2 * MM
        page.draw_line((lx, top + 12 * MM), (lx + lw * MM, top + 12 * MM), color=RULE, width=0.7)
        fx = lx + lw * MM + 6 * MM
    text(page, fx - 4 * MM, top + 11 * MM, "/", 10.5, color=SOFT)
    page.draw_line((fx, top + 12 * MM), (fx + 12 * MM, top + 12 * MM), color=RULE, width=0.7)

    guide_y = top + 20 * MM
    text(page, M, guide_y, "한 줄에 한 팀씩 적어 주세요. 좌석은 체크인 때 한 팀이 나란히 앉도록 배정됩니다.", 10, color=INK)
    text(page, M, guide_y + 5.5 * MM, "처음 오신 분은 VIP 칸에, 함께 모시고 온 성도님은 초청자 칸에 O 표시해 주세요.", 10, color=INK)

    # QR + caption
    page.insert_image(fitz.Rect(qr_x, qr_y, qr_x + qr_size, qr_y + qr_size), filename=str(QR))
    text(page, qr_x - 34 * MM, qr_y + 10 * MM, "휴대폰 카메라로 찍으면", 9, color=SOFT, align="r", w=31 * MM)
    text(page, qr_x - 34 * MM, qr_y + 15 * MM, "온라인으로 바로", 9, color=SOFT, align="r", w=31 * MM)
    text(page, qr_x - 34 * MM, qr_y + 20 * MM, "신청하실 수 있습니다", 9, bold=True, color=ACCENT, align="r", w=31 * MM)
    text(page, qr_x, qr_y + qr_size + 3.6 * MM, "falling.eventgo.kr/apply", 7.5, color=SOFT, align="c", w=qr_size)

    # ---------- table ----------
    t_top = guide_y + 10 * MM
    h1, h2 = 7 * MM, 7 * MM                   # two header rows (group row + sub row)
    foot_h = 17 * MM
    row_h = (H - M - foot_h - (t_top + h1 + h2)) / ROWS
    xs = [M]
    for c in COLS: xs.append(xs[-1] + c[1] * MM)
    right = xs[-1]
    head_bottom = t_top + h1 + h2
    t_bottom = head_bottom + row_h * ROWS

    # header fill (+ staff column greyed down the whole table)
    page.draw_rect(fitz.Rect(M, t_top, right, head_bottom), color=None, fill=HEAD_BG)
    page.draw_rect(fitz.Rect(xs[-2], head_bottom, right, t_bottom), color=None, fill=STAFF_BG, fill_opacity=0.55)

    # header labels
    vip_i = 3
    for i, (label, _, _, _) in enumerate(COLS):
        x0, x1 = xs[i], xs[i + 1]
        if i in (vip_i, vip_i + 1):
            text(page, x0, t_top + h1 + h2 / 2 + 1.3 * MM, label, 10, bold=True, align="c", w=x1 - x0)
        elif i == len(COLS) - 1:
            text(page, x0, t_top + (h1 + h2) / 2 - 0.4 * MM, "입력", 9, bold=True, align="c", w=x1 - x0)
            text(page, x0, t_top + (h1 + h2) / 2 + 3.6 * MM, "(봉사자)", 7, color=SOFT, align="c", w=x1 - x0)
        else:
            text(page, x0, t_top + (h1 + h2) / 2 + 1.4 * MM, label, 10, bold=True, align="c", w=x1 - x0)
    text(page, xs[vip_i], t_top + h1 / 2 + 1.4 * MM, "VIP / 초청자 (O 체크)", 9, bold=True, align="c", w=xs[vip_i + 2] - xs[vip_i])

    # rules
    page.draw_line((M, t_top), (right, t_top), color=INK, width=1.8)
    page.draw_line((xs[vip_i], t_top + h1), (xs[vip_i + 2], t_top + h1), color=RULE, width=0.6)
    page.draw_line((M, head_bottom), (right, head_bottom), color=RULE, width=0.8)
    for r in range(1, ROWS):
        y = head_bottom + row_h * r
        page.draw_line((M, y), (right, y), color=RULE, width=0.6)
    page.draw_line((M, t_bottom), (right, t_bottom), color=INK, width=1.8)
    for i, x in enumerate(xs[1:-1], start=1):
        y0 = t_top + h1 if i == vip_i + 1 else t_top     # VIP|초청자 split starts under the group row
        page.draw_line((x, y0), (x, t_bottom), color=RULE, width=0.6)
    # emphasise the VIP/초청자 pair (like the reference's highlighted column)
    for x in (xs[vip_i], xs[vip_i + 2]):
        page.draw_line((x, t_top), (x, t_bottom), color=ACCENT, width=1.6)

    # body prefills
    for r in range(ROWS):
        y0 = head_bottom + row_h * r
        base = y0 + row_h / 2 + 1.5 * MM
        text(page, xs[0], base, str(r + 1), 10, color=SOFT, align="c", w=xs[1] - xs[0])
        for i, (_, _, pre, _) in enumerate(COLS):
            if pre and i != 0:
                size = 11 if pre == "□" else 9.5
                text(page, xs[i], base, pre, size, color=SOFT, align="c", w=xs[i + 1] - xs[i])

    # ---------- footer ----------
    fy = t_bottom + 5.5 * MM
    lines = [
        "개인정보 수집·이용 동의: 좌석 배정과 행사 안내를 위해 성함과 연락처를 받으며, 행사 후 30일 안에 삭제합니다. 대표자 서명으로 동의를 확인합니다.",
        "행사 후 그날의 플레이리스트와 사진은 신청하신 모든 분께 보내드립니다. 다음에 좋은 자리가 생기면 초대장도 전해드리려 하니, 원치 않으시면 '받지 않음'에 체크해 주세요.",
    ]
    for k, s in enumerate(lines):
        text(page, M, fy + k * 5 * MM, s, 8.3, color=SOFT)
    text(page, M, fy + 10.5 * MM, "입력 칸은 봉사자가 운영앱 '엑셀 일괄 등록'에 옮겨 적은 뒤 체크합니다.", 7.5, color=SOFT)
    text(page, M, fy + 10.5 * MM, "FALLing in Love · 2026. 10. 11. 한신성전 Chapel & Garden", 7.5, color=SOFT, align="r", w=right - M)


doc = fitz.open()
page_fonts = {"R": fitz.Font(fontfile=FONT_R), "B": fitz.Font(fontfile=FONT_B)}
for _ in range(PAGES):
    build(doc)
doc.set_metadata({"title": "2026 온출전 FALLing in Love · 현장 참여 신청서", "author": "창동염광교회"})
doc.subset_fonts()
doc.save(OUT, garbage=4, deflate=True)
print(OUT, f"{OUT.stat().st_size // 1024} KB", f"{PAGES} page(s)")
