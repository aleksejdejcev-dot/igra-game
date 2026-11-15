#!/usr/bin/env python3
"""Split converted source texts into private JSON chapters with stable paragraph IDs."""
from __future__ import annotations
import json, re, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / 'tools/inventory.json'
OUT = ROOT / 'tools/_chapters'
PUBLIC = ROOT / 'src/data/texts/texts-index.json'
MANIFEST = ROOT / 'tools/texts-id-manifest.json'
ORDINAL = r'(?:[IVXLC]+|\d+|перв\w*|втор\w*|трет\w*|четверт\w*|пят\w*|шест\w*|седьм\w*|восьм\w*|девят\w*|десят\w*)'
HEADING = re.compile(rf'^(?:Глава\s+(?:[IVXLC]+|\d+)|ДЕЙСТВИЕ\s+{ORDINAL}|АКТ\s+{ORDINAL}|СЦЕНА\s+{ORDINAL}|КАРТИНА\s+{ORDINAL}|ЯВЛЕНИЕ\s+{ORDINAL}|ПРОЛОГ)\b.*$', re.I)
NUMBERED_SCENE = re.compile(r'^\[N\.?\s*\d+\s*(?:[-–—]\s*)?[^]]+\]$', re.I)

def is_heading(line: str, allow_uppercase: bool = True) -> bool:
    if HEADING.match(line) or NUMBERED_SCENE.match(line):
        return True
    letters = [c for c in line if c.isalpha()]
    return allow_uppercase and bool(letters) and len(line) <= 100 and line == line.upper() and not line.endswith(('.', '!', '?'))

def slug(text: str) -> str:
    text = unicodedata.normalize('NFKD', text.lower().replace('ё','е'))
    text = ''.join(c for c in text if not unicodedata.combining(c))
    translit = str.maketrans({
        'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ж':'zh','з':'z','и':'i','й':'i',
        'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
        'ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e',
        'ю':'yu','я':'ya'
    })
    text = text.translate(translit)
    text = re.sub(r'[^a-z0-9]+', '-', text).strip('-')
    return text[:42] or 'book'

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for stale in OUT.glob('*.json'):
        stale.unlink()
    records = json.loads(INVENTORY.read_text(encoding='utf-8'))
    books = []
    for item in records:
        rel = item.get('convertedText')
        if not rel or Path(rel).name.lower() == 'sources.txt':
            continue
        path = ROOT / rel
        if not path.exists():
            continue
        lines = [line.strip() for line in path.read_text(encoding='utf-8').splitlines()]
        groups: list[tuple[str,list[str]]] = []
        current_title = ''
        current: list[str] = []
        for line in lines:
            if not line:
                continue
            allow_uppercase = Path(item['path']).suffix.lower() not in {'.pdf', '.html', '.htm'}
            if is_heading(line, allow_uppercase=allow_uppercase):
                if current:
                    groups.append((current_title or 'Начало', current))
                    current_title = line
                elif current_title:
                    current_title = f'{current_title} — {line}'
                else:
                    current_title = line
                current = []
            else:
                current.append(line)
        if current:
            groups.append((current_title or 'Текст', current))
        if not groups:
            continue
        source_stem = Path(item['path']).stem
        book_id = slug(source_stem)
        chapters = []
        for ci, (title, paragraphs) in enumerate(groups, 1):
            chapter_id = f'{book_id}-{ci:03d}'
            json_path = OUT / f'{chapter_id}.json'
            chapter_paragraphs = [{'id': f't-{book_id}-{ci:03d}-{pi:04d}', 'text': p}
                                  for pi, p in enumerate(paragraphs, 1)]
            data = {'id': chapter_id, 'title': title, 'paragraphs': chapter_paragraphs}
            json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            chapters.append({'id': chapter_id, 'title': title, 'paragraphIds': [p['id'] for p in chapter_paragraphs],
                             'localFile': f'tools/_chapters/{chapter_id}.json', 'neededInGame': False})
        books.append({'id': book_id, 'title': source_stem, 'source': item['path'], 'chapters': chapters})
    private_index = {'books': books}
    (OUT / 'texts-index.json').write_text(json.dumps(private_index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    manifest = {'books': [{'id': b['id'], 'chapters': [{'id': c['id'], 'paragraphIds': c['paragraphIds']}
                                                       for c in b['chapters']]} for b in books]}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    public_index = {'books': [{'id': b['id'], 'title': b['title'], 'chapters': [
        {'id': c['id'], 'title': c['title'], 'neededInGame': False} for c in b['chapters']]} for b in books]}
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC.write_text(json.dumps(public_index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"{len(books)} books, {sum(len(b['chapters']) for b in books)} chapters, {sum(sum(len(json.loads((OUT / (c['id']+'.json')).read_text())['paragraphs']) for c in b['chapters']) for b in books)} paragraphs")
if __name__ == '__main__': main()
