// 한국어 조사 자동선택 — 대사에 "은(는)"처럼 괄호로 박아넣지 말고 반드시 이걸 쓴다.
//
// 쓰는 법:  `${name}${josa(name, "은는")} 쓰러졌다...`   →  "파이리는 쓰러졌다..."
// kind 문자열은 **[받침있음, 받침없음] 순서**다. ("은는" = 받침있으면 은, 없으면 는)
//   은는 · 이가 · 을를 · 과와 · 로("(으)로")
export type Josa = "은는" | "이가" | "을를" | "과와" | "로";

// 숫자로 끝나는 말(예: "Lv.6")은 읽는 소리로 받침이 갈린다.
//  0영 3삼 6육 = 받침 있음 · 1일 7칠 8팔 = ㄹ받침 · 2이 4사 5오 9구 = 받침 없음
const DIGIT_JONG = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0];   // 값: 0=없음, 8=ㄹ, 그 외=받침 있음

export function josa(word: string, kind: Josa): string {
  const last = word.slice(-1);
  const ch = last.charCodeAt(0);
  let jong: number;                                 // 종성(받침) 코드. 0 = 받침 없음, 8 = ㄹ
  if (ch >= 0xac00 && ch <= 0xd7a3) jong = (ch - 0xac00) % 28;   // 한글
  else if (last >= "0" && last <= "9") jong = DIGIT_JONG[Number(last)];
  else return kind === "로" ? "로" : kind[1];       // 영문·기호·빈 문자열 → 판정 불가, 무난한 쪽으로
  // "로"만 규칙이 다르다: 받침이 없거나 ㄹ 받침이면 "로", 그 외엔 "으로".
  if (kind === "로") return jong === 0 || jong === 8 ? "로" : "으로";
  return jong !== 0 ? kind[0] : kind[1];
}
