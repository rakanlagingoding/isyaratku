"""Referensi perilaku Mode A (rule-based), ditulis dalam Python sebagai spesifikasi.

Implementasi TypeScript di src/lib/translator/ruleBased.ts harus menghasilkan output
yang SAMA untuk setiap pasangan di eval/gloss_pairs.json.

Hasil saat dibuat: mustPass 8/8, pasangan 'mudah' 34/34, 'sulit' 2/6 (sengaja,
untuk menunjukkan batas Mode A dibanding Mode B).

Jalankan dari root repo:  python3 eval/reference_rules.py
"""
import json
import re

LEX = json.load(open("src/data/lexicon.json", encoding="utf-8"))["entries"]
RULES = json.load(open("src/data/rules.json", encoding="utf-8"))
PAIRS = json.load(open("eval/gloss_pairs.json", encoding="utf-8"))["pairs"]


def translate(glosses):
    # R1 fingerspell + lexicon lookup
    toks = []
    for g in glosses:
        m = re.match(r"^FS:([A-Z]{1,20})$", g)
        if m:
            toks.append({"g": g, "w": m.group(1).capitalize(), "c": "name"})
        else:
            toks.append({"g": g, "w": LEX[g]["word"], "c": LEX[g]["cat"]})

    def is_pred(t):
        return t["c"] in ("verb", "adj")

    # R2 aspect before first predicate
    asp = [t for t in toks if t["c"] == "aspect"]
    if asp and any(is_pred(t) for t in toks):
        rest = [t for t in toks if t["c"] != "aspect"]
        i = next(i for i, t in enumerate(rest) if is_pred(t))
        toks = rest[:i] + asp + rest[i:]

    # R3 negation before predicate (and before any aspect directly in front of it)
    neg = [t for t in toks if t["c"] == "neg"]
    if neg and any(is_pred(t) for t in toks):
        rest = [t for t in toks if t["c"] != "neg"]
        i = next(i for i, t in enumerate(rest) if is_pred(t))
        while i > 0 and rest[i - 1]["c"] == "aspect":
            i -= 1
        toks = rest[:i] + neg + rest[i:]

    # R4 SIAPA / KAPAN at the end move to the front
    if toks[-1]["g"] in ("SIAPA", "KAPAN"):
        toks = [toks[-1]] + toks[:-1]

    # R5 'ke' before a place right after PERGI / PULANG
    out = []
    for i, t in enumerate(toks):
        if t["c"] == "place" and i > 0 and toks[i - 1]["g"] in ("PERGI", "PULANG"):
            out.append({"g": "", "w": "ke", "c": "prep"})
        out.append(t)
    toks = out

    # R6 default subject
    j = 0
    while j < len(toks) and toks[j]["c"] in ("greeting", "request"):
        j += 1
    if j < len(toks) and toks[j]["c"] in ("verb", "aspect", "neg", "adj"):
        toks.insert(j, {"g": "", "w": RULES["defaultSubject"], "c": "pronoun"})

    # R7 comma after a leading greeting, R8 capital + punctuation
    words = [t["w"] for t in toks]
    if toks[0]["c"] == "greeting" and len(toks) > 1:
        words[0] += ","
    s = " ".join(words)
    s = s[0].upper() + s[1:]
    s += "?" if any(t["c"] == "question" for t in toks) else "."
    return s


if __name__ == "__main__":
    for case in RULES["mustPass"]:
        got = translate(case["glosses"])
        status = "OK " if got == case["expected"] else "FAIL"
        print(f"[mustPass {status}] {' '.join(case['glosses'])} -> {got}")
    score = {}
    for p in PAIRS:
        got = translate(p["glosses"])
        hit, total = score.get(p["difficulty"], (0, 0))
        score[p["difficulty"]] = (hit + (got == p["reference"]), total + 1)
    for k, (hit, total) in score.items():
        print(f"{k}: {hit}/{total} exact match")
