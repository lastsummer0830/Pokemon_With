---
name: ""
metadata: 
  node_type: memory
  originSessionId: a2ca6ebd-a8cd-4f7b-b46a-106c004cbd2b
---

사용자가 **"~ 후보 추려서 보여줘 / 정리해줘 / 내가 고를게"** 류로 요청하면:
1. 후보 에셋을 **`01_Resources/Pick/<카테고리>/`** 아래 하위폴더로 정리(성별·종류별), 파일명에 번호+설명(`남_01_RED_정통.png`).
2. 한눈에 비교용 **미리보기 몽타주 PNG**(그리드 + 파일명 라벨)도 같이 만들어 둔다. PIL로 생성.
3. **사용자가 고른 뒤에야** public/assets로 옮겨 코드에 적용. Pick은 "고르기 전 보관소".

**Why:** 사용자가 직접 눈으로 보고 고르는 방식을 선호. 임의로 골라 적용하면 다시 까임(인게임 캐릭터 사례).

**How to apply:** 후보 요청 → AR 원본(`/mnt/d/Pokemon Another Red_PWT_250829/Graphics`) 등에서 추려 Pick에 정리 + 몽타주 → AskUserQuestion 등으로 고르게 → 확정 후 적용. AGENTS.md §3에도 규칙 기록됨. [[mypokemon-project]] [[launch-via-bat-only]]
