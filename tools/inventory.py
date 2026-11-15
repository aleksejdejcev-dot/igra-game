#!/usr/bin/env python3
"""Inventory and convert source texts/audio without modifying originals."""
from __future__ import annotations

import json
import mimetypes
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from docx import Document
from docx.oxml.ns import qn
from mutagen import File as MutagenFile
from pypdf import PdfReader
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIRS = (ROOT / 'source/texts', ROOT / 'source/audio')
TXT_DIR = ROOT / 'tools/_txt'
INVENTORY = ROOT / 'tools/inventory.json'


def normalized(value: str) -> str:
    return ' '.join(re.sub(r'[^\w]+', ' ', value.lower().replace('ё', 'е').replace('_', ' ')).split())


def classify(path: Path) -> tuple[str, str]:
    name = normalized(path.stem)
    if name == 'sources':
        return 'optional', 'Список источников загруженных текстов; нужен для воспроизводимости, не для игры.'
    if path.parent.name == 'audio':
        if 'борис годунов' in name:
            return 'needed', 'Запись «Борис Годунов» для граммофонной комнаты.'
        if 'опричник' in name:
            return 'needed', 'Запись оперы «Опричник» для граммофонной комнаты.'
        if 'купец калашников' in name:
            return 'needed', 'Запись оперы «Купец Калашников» для граммофонной комнаты.'
        return 'optional', 'Дополнительная аудиозапись, не совпадающая с тремя заданиями.'
    if 'карамзин' in name and 'история том' in name:
        return 'needed', 'Полный том об Иоанне IV нужен как книжный источник для исторических заданий.'
    if 'карамзин' in name:
        return 'needed', 'Отрывок из Карамзина используется в заданиях об Иване IV.'
    if 'князь серебряный' in name:
        return 'needed', 'Роман А.К. Толстого нужен для связей картин и литературных эпизодов.'
    if 'смерть иоанна' in name:
        return 'needed', 'Пьеса А.К. Толстого нужна для шахматного эпизода и текстовых связей.'
    if 'репнин' in name:
        return 'needed', 'Текст А.К. Толстого нужен для задания о князе Репнине.'
    if 'шибанов' in name:
        return 'needed', 'Баллада А.К. Толстого нужна для связи картин с литературой.'
    if 'пушкин борис годунов' in name:
        return 'needed', 'Трагедия А.С. Пушкина — источник для задания о Борисе Годунове.'
    if 'либретто' in name or 'libretto' in name:
        return 'needed', 'Текст оперного либретто нужен для субтитров граммофонного задания.'
    if 'лажечников опричник' in name:
        return 'needed', 'Трагедия И.И. Лажечникова — источник оперы и задания об опричнине.'
    if 'микешин' in name or 'тысячелетие россии' in name:
        return 'needed', 'Источник необходим для задания о памятнике Тысячелетию России.'
    if 'василиса мелентьева' in name:
        return 'needed', 'Пьеса А.Н. Островского нужна для задания о семье Ивана IV.'
    if 'купец калашников' in name:
        return 'needed', 'Поэма М.Ю. Лермонтова нужна для задания о соответствиях произведений и опер.'
    if 'истории картины репина' in name:
        return 'optional', 'История создания картины полезна как справка, но текущие задания её не требуют.'
    if 'соловьев' in name:
        return 'optional', 'Общий исторический очерк полезен как справочный контекст, но не назван источником задания.'
    return 'unused', 'Содержимое не относится к заявленным источникам и текущим заданиям.'


def docx_text(path: Path) -> tuple[str, int | None, int]:
    document = Document(path)
    xml_paragraphs = document._element.body.xpath('.//w:p')
    paragraphs = len(xml_paragraphs)
    header_footer = set()
    for section in document.sections:
        for part in (section.header, section.footer, section.first_page_header, section.first_page_footer):
            for paragraph in part.paragraphs:
                value = paragraph.text.strip()
                if value:
                    header_footer.add(normalized(value))
    blocks: list[str] = []
    body = document._element.body
    for element in body.iterchildren():
        if element.tag == qn('w:p'):
            text = ''.join(element.itertext()).strip()
            # Word XML itertext also contains formatting metadata. Re-read the
            # matching python-docx paragraph for human-readable run text.
            paragraph = next((p for p in document.paragraphs if p._p is element), None)
            if paragraph is not None:
                text = paragraph.text.strip()
            if text:
                blocks.append(text)
        elif element.tag == qn('w:tbl'):
            from docx.table import Table
            table = Table(element, document)
            for row in table.rows:
                cells = [' '.join(p.text.strip() for p in cell.paragraphs if p.text.strip()) for cell in row.cells]
                line = '\t'.join(cell for cell in cells if cell)
                if line:
                    blocks.append(line)
    text = clean_text('\n\n'.join(blocks), header_footer)
    pages = None
    try:
        with zipfile.ZipFile(path) as archive:
            xml = archive.read('docProps/app.xml').decode('utf-8', errors='ignore')
        match = re.search(r'<Pages>(\d+)</Pages>', xml)
        if match:
            pages = int(match.group(1))
    except (KeyError, zipfile.BadZipFile):
        pass
    if pages is None:
        rendered_breaks = len(document._element.body.xpath('.//w:lastRenderedPageBreak'))
        explicit_breaks = len(document._element.body.xpath('.//w:br[@w:type="page"]'))
        pages = max(1, rendered_breaks + explicit_breaks + 1)
    return text, pages, paragraphs


def pdf_text(path: Path) -> tuple[str, int, int, int]:
    reader = PdfReader(path)
    page_texts = [page.extract_text() or '' for page in reader.pages]
    pages_without_text = sum(not text.strip() for text in page_texts)
    frequent_headers: dict[str, int] = {}
    for page_text in page_texts:
        for line in set(normalized(line) for line in page_text.splitlines() if line.strip()):
            frequent_headers[line] = frequent_headers.get(line, 0) + 1
    repeated = {line for line, count in frequent_headers.items() if count >= max(3, len(page_texts) // 5)}
    filtered = []
    active_action = ''
    inside_foreword = False
    for page_text in page_texts:
        lines = []
        for line in page_text.splitlines():
            norm = normalized(line)
            compact = norm.replace(' ', '')
            if norm.startswith('informazioni '):
                inside_foreword = True
                continue
            if inside_foreword:
                if 'действующиелица' in compact:
                    inside_foreword = False
                    lines.append('Действующие лица')
                continue
            if re.match(r'^(?:п и чайковский|н и куликов|а г рубинштейн)\b', norm):
                action = re.search(r'действие\s+(первое|второе|третье|четвертое)', norm)
                if action and action.group(1) != active_action:
                    active_action = action.group(1)
                    lines.append(f'Действие {active_action}')
                continue
            action_header = re.fullmatch(r'действие (первое|второе|третье|четвертое) (?:опричник|купец калашников)', norm)
            if action_header:
                if action_header.group(1) != active_action:
                    active_action = action_header.group(1)
                    lines.append(f'Действие {active_action}')
                continue
            if norm in repeated:
                continue
            lines.append(line)
        filtered.append('\n'.join(lines))
    text = clean_text('\n\n'.join(filtered))
    paragraphs = [line for line in text.splitlines() if len(line.strip()) > 1]
    return text, len(reader.pages), len(paragraphs), pages_without_text


def old_doc_text(path: Path) -> tuple[str, int | None, int]:
    soffice = subprocess.run(['soffice', '--headless', '--convert-to', 'txt:Text', '--outdir', str(TXT_DIR), str(path)],
                             text=True, capture_output=True, check=False)
    converted = TXT_DIR / f'{path.stem}.txt'
    if soffice.returncode != 0 or not converted.exists():
        raise RuntimeError(f'Не удалось прочитать DOC через LibreOffice: {soffice.stderr.strip()}')
    text = clean_text(converted.read_text(encoding='utf-8', errors='replace'))
    paragraphs = len([part for part in re.split(r'\n\s*\n', text) if part.strip()])
    converted.unlink()
    return text, None, paragraphs


def clean_text(value: str, header_footer: set[str] | None = None) -> str:
    header_footer = header_footer or set()
    result = []
    for raw in value.replace('\x0c', '\n').replace('\x0b', '\n').replace('\u00ad', '').splitlines():
        line = re.sub(r'\s+', ' ', raw).strip()
        if not line or normalized(line) in header_footer:
            continue
        if re.search(r'\.{4,}|…{2,}', line):
            continue
        if re.fullmatch(r'(?:[—–-]\s*)?\d+(?:\s*(?:из|/|of)\s*\d+)?\s*(?:[—–-])?', line, re.IGNORECASE):
            continue
        if re.fullmatch(r'[.·…\s—–-]*\d{1,3}[.·…\s—–-]*', line):
            continue
        if 'www.operalib.eu' in line.lower():
            continue
        result.append(line)
    return '\n'.join(result)


def audio_info(path: Path) -> dict[str, Any]:
    audio = MutagenFile(path, easy=False)
    info: dict[str, Any] = {'durationSec': round(float(audio.info.length), 3) if audio and audio.info else None,
                             'bitrate': getattr(audio.info, 'bitrate', None) if audio and audio.info else None,
                             'tags': {}}
    if audio and audio.tags:
        for key, value in audio.tags.items():
            if key.startswith('APIC'):
                continue
            raw_values = value if isinstance(value, (list, tuple)) else [value]
            info['tags'][key] = [str(item) for item in raw_values]
    return info


def main() -> None:
    TXT_DIR.mkdir(parents=True, exist_ok=True)
    records = []
    for root in SOURCE_DIRS:
        if not root.exists():
            continue
        for path in sorted(item for item in root.rglob('*') if item.is_file()):
            relative = path.relative_to(ROOT).as_posix()
            ext = path.suffix.lower()
            item: dict[str, Any] = {
                'path': relative,
                'sizeBytes': path.stat().st_size,
                'type': mimetypes.guess_type(path.name)[0] or ext.lstrip('.') or 'unknown',
            }
            if root == ROOT / 'source/audio':
                item['classification'], item['reason'] = classify(path)
                item.update(audio_info(path))
            elif ext in {'.docx', '.pdf', '.doc', '.txt', '.md'}:
                if ext == '.docx':
                    text, pages, paragraphs = docx_text(path)
                elif ext == '.pdf':
                    text, pages, paragraphs, pages_without_text = pdf_text(path)
                elif ext == '.doc':
                    text, pages, paragraphs = old_doc_text(path)
                else:
                    text = clean_text(path.read_text(encoding='utf-8', errors='replace'))
                    pages = None
                    paragraphs = len([part for part in re.split(r'\n\s*\n', text) if part.strip()])
                txt_path = TXT_DIR / path.relative_to(root).with_suffix('.txt')
                txt_path.parent.mkdir(parents=True, exist_ok=True)
                if path.resolve() != txt_path.resolve():
                    txt_path.write_text(text.rstrip() + '\n', encoding='utf-8')
                item.update({
                    'classification': classify(path)[0],
                    'reason': classify(path)[1],
                    'preview300': text[:300],
                    'pageCount': pages,
                    'paragraphCount': paragraphs,
                    'convertedText': txt_path.relative_to(ROOT).as_posix(),
                })
                if ext == '.pdf':
                    item['pagesWithoutTextLayer'] = pages_without_text
                    item['textLayerCoveragePercent'] = round(100 * (pages - pages_without_text) / pages, 2) if pages else 100
            elif ext in {'.html', '.htm'}:
                soup = BeautifulSoup(path.read_text(encoding='utf-8', errors='replace'), 'html.parser')
                content = soup.select_one('.entry-content') or soup.select_one('article') or soup.body or soup
                for node in content.select('script,style,nav,header,footer,.sharedaddy,.related-posts'):
                    node.decompose()
                text = clean_text(content.get_text('\n', strip=True))
                paragraphs = [part.strip() for part in re.split(r'\n\s*\n|\n', text) if part.strip()]
                txt_path = TXT_DIR / path.relative_to(root).with_suffix('.txt')
                txt_path.parent.mkdir(parents=True, exist_ok=True)
                txt_path.write_text(text.rstrip() + '\n', encoding='utf-8')
                item.update({
                    'classification': classify(path)[0],
                    'reason': classify(path)[1],
                    'preview300': text[:300],
                    'pageCount': None,
                    'paragraphCount': len(paragraphs),
                    'convertedText': txt_path.relative_to(ROOT).as_posix(),
                })
            else:
                item['classification'], item['reason'] = classify(path)
            records.append(item)
    INVENTORY.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({
        'files': len(records),
        'textFiles': sum('preview300' in item for item in records),
        'audioFiles': sum('durationSec' in item for item in records),
        'classifications': {key: sum(item.get('classification') == key for item in records)
                            for key in ('needed', 'optional', 'unused')},
        'inventory': str(INVENTORY.relative_to(ROOT)),
        'convertedTextDir': str(TXT_DIR.relative_to(ROOT)),
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
