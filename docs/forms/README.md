# 현장 참여 신청서 (수기)

온라인 신청을 못 한 분들을 위한 당일 현장용 양식. A4 가로, 한 장에 8팀.

| 파일 | 용도 |
|---|---|
| `현장참여신청서.pdf` | 인쇄용 (기준본) |
| `현장참여신청서.docx` | 문구·칸 수정용 (Word) |
| `qr-apply.png` | 제목 옆 QR → `https://falling.eventgo.kr/apply` |

칸: No · 성함 · 연락처 · VIP / 초청자 (O 체크) · 함께 오신 분 · 다음 초대장(받지 않음 □) · 동의 서명 · 입력(봉사자).
봉사자는 작성된 장을 운영앱 **엑셀 일괄 등록**으로 옮긴다 — VIP에 O면 구분 `초대받음`, 초청자에 O면 `초청`; 함께 오신 분 → 동행1~5; 받지 않음 체크 → 초대장수신 `아니오`.

다시 만들기 (칸을 바꾸면 두 스크립트를 함께 고칠 것):

```bash
python3 docs/forms/make_onsite_form.py        # PDF (PyMuPDF, 나눔바른고딕)
node docs/forms/make_onsite_form.mjs <node_modules/docx 경로>   # Word
```
