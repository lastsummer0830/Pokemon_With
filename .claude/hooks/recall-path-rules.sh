#!/usr/bin/env bash
# recall-path-rules — 압축 직후, 사라진 조건부 규칙의 '존재'를 다시 알린다.
#
# 배경: .claude/rules/*.md 중 `paths:` 프론트매터가 붙은 규칙은 매칭 파일을 읽을 때만
#       컨텍스트에 들어오고, 압축되면 대화 기록과 함께 요약돼 사라진다.
#       공식 문서(context-window#what-survives-compaction):
#       "Rules with `paths:` frontmatter | Lost until a matching file is read again"
#
# 설계: SessionStart matcher:"compact" 전용 → 평상시 세션 시작 부하 0.
#       규칙 '전문'이 아니라 '파일명 + 트리거 경로'만 낸다(필요한 것만 다시 읽게).
#       목록은 하드코딩하지 않고 rules/ 에서 매번 만든다(규칙이 늘거나 개명돼도 따라감).
#       실패 시 조용히 통과 — 작업을 방해하지 않는다.
#
# 설치: 2026-08-04 (정비 S4)
set -u

d="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$d" ] && [ -d "$d/.claude/rules" ] || exit 0

out=""
for f in "$d"/.claude/rules/*.md; do
  [ -f "$f" ] || continue
  grep -q '^paths:' "$f" || continue   # paths: 없는 규칙은 압축 후에도 살아 있다
  pats=$(awk '/^paths:/{p=1;next} /^---/{p=0} p' "$f" \
         | sed 's/^[[:space:]]*-[[:space:]]*//; s/"//g' | paste -sd' ' -)
  out="${out}- .claude/rules/$(basename "$f")  →  ${pats}
"
done
[ -n "$out" ] || exit 0

printf '%s\n%s\n\n%s' \
  '[압축 후 알림] 아래 조건부 규칙은 압축으로 컨텍스트에서 사라졌다.' \
  '해당 경로의 파일을 고치기 전에 짝이 되는 규칙 파일을 먼저 Read 할 것.' \
  "$out"
