#!/usr/bin/env bash
# UserPromptSubmit 훅: 매 턴 '0순위 운영 계약'(AGENTS.md 상단) 요지를 컨텍스트에 주입.
# 훅으로 못 막는 것(대화 중 단정·헛확신·검증 생략)을 매 턴 앞에 세우는 게 목적.
# stdout(exit 0)이 Claude 컨텍스트에 추가됨 — 짧게(길면 배너 실명).
cat <<'EOF'
[0순위 운영 계약 — AGENTS.md 상단, 매 턴 자동]
· 단정 전: memory·인계문서는 '그때의 사실' → 실제 파일 열어 재검증하고 말한다.
· '됐다/반영됐다' 전: /verify·playwright로 실동작 확인(못 했으면 '검증 못함' 명시).
· 코딩 전: §8 스킬 라우팅 확인. 반복 실수는 memo 말고 hook으로 승격.
· 모르면 모른다 — 과장·헛확신 금지.
EOF
exit 0
