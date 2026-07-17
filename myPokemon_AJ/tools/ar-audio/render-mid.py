#!/usr/bin/env python3
"""
AR 원본 MIDI(.mid) → ogg 렌더러.

왜 필요한가:
  AR의 일부 BGM은 .ogg가 없고 .mid만 있다(체육관 Gym.mid, 포켓몬센터 Poke Center.mid,
  마트 Poke Mart.mid 등). MIDI는 "악보"일 뿐이라 음색 데이터가 없어서 브라우저(Phaser)가
  바로 재생하지 못한다. 그래서 신시사이저로 소리를 입혀(=렌더) ogg로 굽는다.

왜 이 음색이 "원본"인가:
  AR 원본 폴더 루트에 soundfont.sf2 가 동봉돼 있다. RPG Maker가 MIDI를 재생할 때 쓰는
  그 음색이므로, 이걸로 렌더하면 플레이어가 실제로 듣는 소리와 같아진다.
  (범용 GM 사운드폰트를 쓰면 곡은 같아도 음색이 달라진다 = 원본 재현이 아니다.)

사전 준비 (시스템에 설치하지 않고 스크래치패드에만):
  python3 -m pip install --no-deps --target <스크래치패드>/_pylibs tinysoundfont
  ※ --no-deps 필수: 의존성 pyaudio는 실시간 재생용이라 불필요하고, 빌드도 실패한다.
  실행: PYTHONPATH=<스크래치패드>/_pylibs python3 render-mid.py ...

사용법:
  python3 render-mid.py --mid "Gym" --out ../../public/assets/audio/bgm_gym.ogg
  python3 render-mid.py --mid "Poke Center" --out ../../public/assets/audio/bgm_pc.ogg
  (--ar 로 AR 경로 지정 가능. 생략하면 PC별 후보 경로를 자동 탐색한다.)

⚠️ 함정:
  - 새 ogg를 public/assets/에 넣은 뒤에는 **dev서버를 재시작**해야 한다. 안 그러면
    Vite가 그 파일을 모르고 index.html(text/html)을 200으로 돌려줘 브라우저가
    "Unable to decode audio data"를 뱉는다. 확인:
      curl -s -o /dev/null -w '%{content_type}' http://localhost:5180/assets/audio/bgm_gym.ogg
    → audio/ogg 여야 한다.
  - gain은 기존 곡들(mean -21dB 안팎)에 맞춘 값이다. 올리면 클리핑 난다
    (실제로 기존 bgm_lab.ogg는 max 0.0dB로 클리핑돼 있다).
"""
import argparse
import array
import math
import os
import struct
import subprocess
import sys
import tempfile

# AR 원본 폴더 후보 (PC마다 다름 — AGENTS.md §4-C)
AR_CANDIDATES = [
    "/mnt/d/Pokemon Another Red_PWT_250829",
    "/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829",
]

RATE = 48000      # 렌더 샘플레이트
CHUNK = 1024      # 한 번에 생성할 샘플 수
TAIL_SILENCE = 1.5  # 곡이 끝난 뒤 이만큼 무음이 이어지면 종료(잔향 살리려고 바로 안 끊음)
MAX_SECONDS = 300


def find_ar(explicit=None):
    """AR 원본 폴더를 찾는다. 못 찾으면 추측하지 말고 에러."""
    if explicit:
        if not os.path.isdir(explicit):
            sys.exit(f"AR 경로가 없다: {explicit}")
        return explicit
    for p in AR_CANDIDATES:
        if os.path.isdir(p):
            return p
    sys.exit(
        "AR 원본 폴더를 못 찾았다. --ar 로 직접 지정하거나 아래로 찾아라:\n"
        '  find /mnt/d /mnt/c/Users/*/Desktop -maxdepth 4 -iname "*Another*Red*" -type d'
    )


def render(mid_path, sf2_path, gain_db):
    """mid를 sf2 음색으로 렌더해 float 샘플 배열(스테레오 인터리브)로 돌려준다."""
    import tinysoundfont  # 스크래치패드 설치본 (PYTHONPATH로 넣어줘야 함)

    synth = tinysoundfont.Synth(samplerate=RATE, gain=gain_db)
    synth.sfload(sf2_path)
    seq = tinysoundfont.Sequencer(synth)
    seq.midi_load(mid_path)

    out = array.array("f")
    silence_run = 0.0
    elapsed = 0.0
    while True:
        block = array.array("f")
        block.frombytes(synth.generate(CHUNK).tobytes())
        out.extend(block)
        elapsed += CHUNK / RATE

        if seq.is_empty():  # 시퀀서가 다 돌았으면 잔향만 남은 상태
            peak = max((abs(v) for v in block), default=0.0)
            silence_run = silence_run + CHUNK / RATE if peak < 1e-4 else 0.0
            if silence_run > TAIL_SILENCE:
                break
        if elapsed > MAX_SECONDS:
            break
    return out


def write_wav(samples, path):
    """float 샘플 → 16bit PCM wav (ffmpeg에 넘기려고 중간 파일로만 쓴다)."""
    pcm = array.array("h", (int(max(-1.0, min(1.0, v)) * 32767) for v in samples))
    data = pcm.tobytes()
    with open(path, "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVEfmt ")
        f.write(struct.pack("<IHHIIHH", 16, 1, 2, RATE, RATE * 4, 4, 16))
        f.write(b"data" + struct.pack("<I", len(data)) + data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mid", required=True, help='AR Audio/BGM 안의 곡 이름 (확장자 없이, 예: "Gym")')
    ap.add_argument("--out", required=True, help="출력 .ogg 경로")
    ap.add_argument("--ar", help="AR 원본 폴더 (생략 시 자동탐색)")
    ap.add_argument("--gain", type=float, default=-6.0, help="게인 dB (기본 -6.0 = 기존 BGM과 같은 음량대)")
    ap.add_argument("--quality", type=int, default=5, help="vorbis 품질 0~10 (기본 5)")
    args = ap.parse_args()

    ar = find_ar(args.ar)
    mid_path = os.path.join(ar, "Audio", "BGM", args.mid + ".mid")
    sf2_path = os.path.join(ar, "soundfont.sf2")
    for p in (mid_path, sf2_path):
        if not os.path.isfile(p):
            sys.exit(f"파일이 없다: {p}")

    print(f"렌더 중: {os.path.basename(mid_path)}  (음색: soundfont.sf2)")
    samples = render(mid_path, sf2_path, args.gain)
    peak = max((abs(v) for v in samples), default=0.0)
    if peak >= 0.999:
        print("⚠️ 클리핑 발생 — --gain 을 더 낮춰라")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav = tmp.name
    try:
        write_wav(samples, wav)
        subprocess.run(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
             "-i", wav, "-c:a", "libvorbis", "-q:a", str(args.quality), "-ar", "44100", args.out],
            check=True,
        )
    finally:
        os.unlink(wav)

    secs = len(samples) / 2 / RATE
    size = os.path.getsize(args.out)
    print(f"완료: {args.out}  {secs:.1f}초  {size:,}바이트  피크 {peak:.3f}")
    print("⚠️ public/assets/ 에 새 파일을 넣었으면 dev서버를 재시작할 것 (위 함정 참조)")


if __name__ == "__main__":
    main()
