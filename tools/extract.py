#!/usr/bin/env python3
"""Extract catalog artwork, task-slide images/text, and response zones from source decks."""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

from PIL import Image, ImageDraw
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source'
PAINTING_DECK = SOURCE / 'картины по алфавиту.pptx'
THEME_DECK = SOURCE / 'картины по темам.pptx'
TASK_DECK = SOURCE / 'Игра задания.pptx'


def normalized(value: str) -> str:
    value = unicodedata.normalize('NFKC', value).lower().replace('ё', 'е')
    value = re.sub(r'[^\w]+', ' ', value, flags=re.UNICODE)
    return ' '.join(value.split())


def clean_text(value: str) -> str:
    return '\n'.join(line.strip() for line in value.replace('\x0b', '\n').splitlines()).strip()


def caption_candidates(slide) -> list[str]:
    return [clean_text(shape.text) for shape in slide.shapes
            if shape.has_text_frame and clean_text(shape.text)
            and not clean_text(shape.text).isdigit()]


def parse_caption(caption: str) -> dict:
    flat = ' '.join(caption.split())
    year_match = re.search(r'(?<!\d)((?:18|19|20)\d{2})(?:\s*[-–]\s*((?:18|19|20)?\d{2}|е))?', flat)
    year = year_match.group(0).strip() if year_match else ''
    before_year = flat[:year_match.start()].rstrip(' .;,') if year_match else flat.rstrip(' .;,')

    # Use the separator after the full artist name, skipping initial dots.
    separators = list(re.finditer(r'\.\s+(?=[А-ЯЁA-Z«\[])', before_year))
    separator = next((item for item in separators
                      if len(before_year[:item.start()].strip().rstrip('.').split()) > 1), None)
    artist = ''
    title = ''
    if separator:
        artist = before_year[:separator.start()].strip().rstrip('.')
        title = before_year[separator.end():].strip().rstrip(' .;,')
    elif re.match(r'^[^.!?]{2,80}$', before_year):
        # A small number of alternative labels have no period after the artist.
        match = re.match(r'^([А-ЯЁA-Z]\.\s+\S+)\s+(.+)$', before_year)
        if not match:
            match = re.match(r'^(.+?)\s+([А-ЯЁA-Z].+)$', before_year)
        if match:
            artist, title = match.group(1).strip(), match.group(2).strip()
    artist = re.sub(r'\s*\((?:до\s+)?\d{4}\)\s*$', '', artist).strip()
    artist_short = artist.rsplit(' ', 1)[-1].rstrip('.') if artist else ''
    if not title or not artist:
        return {'artist': '', 'artistShort': '', 'title': '', 'year': year}
    return {'artist': artist, 'artistShort': artist_short, 'title': title, 'year': year}


def picture_shapes(slide):
    return [shape for shape in slide.shapes if shape.shape_type == MSO_SHAPE_TYPE.PICTURE]


def unique_images(slide):
    seen = set()
    result = []
    for shape in picture_shapes(slide):
        digest = hashlib.sha256(shape.image.blob).hexdigest()
        if digest not in seen:
            seen.add(digest)
            result.append(shape)
    return result


def fit_image(image: Image.Image, maximum: int) -> Image.Image:
    image = image.convert('RGB')
    scale = min(1, maximum / max(image.size))
    if scale < 1:
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    return image


def image_for_shape(shape) -> Image.Image:
    from io import BytesIO
    image = Image.open(BytesIO(shape.image.blob)).convert('RGBA')
    left, top, right, bottom = shape.crop_left, shape.crop_top, shape.crop_right, shape.crop_bottom
    if any((left, top, right, bottom)):
        width, height = image.size
        image = image.crop((round(left * width), round(top * height), round((1-right) * width), round((1-bottom) * height)))
    return image


def discover_theme_orders(paintings: list[dict]) -> None:
    theme_deck = Presentation(THEME_DECK)
    candidates = []
    for slide_number, slide in enumerate(theme_deck.slides, start=1):
        text_candidates = caption_candidates(slide)
        # The complete (usually longest) caption is preferred, while all lines
        # remain available for matching when the presentation uses a short label.
        primary = max(text_candidates, key=len, default='')
        candidates.append((slide_number, text_candidates, primary))

    for painting in paintings:
        source_caption = normalized(painting['caption'].replace('\n', ' '))
        source_title = normalized(painting['title'])
        best = (0.0, None)
        for slide_number, texts, primary in candidates:
            for text in [primary, *texts]:
                key = normalized(text)
                title_score = SequenceMatcher(None, source_title, normalized(parse_caption(text)['title'])).ratio() if source_title else 0
                caption_score = SequenceMatcher(None, source_caption, key).ratio() if source_caption else 0
                score = max(title_score, caption_score)
                if score > best[0]:
                    best = (score, slide_number)
        painting['themeOrder'] = best[1] if best[0] >= 0.68 else None


def write_paintings() -> tuple[list[dict], list[int], int]:
    deck = Presentation(PAINTING_DECK)
    out_dir = ROOT / 'public/assets/paintings'
    out_dir.mkdir(parents=True, exist_ok=True)
    old_path = ROOT / 'src/data/paintings.json'
    old_records = json.loads(old_path.read_text(encoding='utf-8')) if old_path.exists() else []
    by_id = {record.get('id'): record for record in old_records}
    records, skipped = [], []
    duplicate_count = 0
    def webp_variant(image: Image.Image, maximum: int, destination: Path) -> None:
        image = image.convert('RGB')
        scale = min(1, maximum / max(image.size))
        if scale < 1:
            image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
        image.save(destination, 'WEBP', quality=91 if image.width * image.height < 1_000_000 else 88, method=6)

    for slide_number, slide in enumerate(deck.slides, start=1):
        if slide_number == 1:
            continue
        images = unique_images(slide)
        duplicate_count += len(picture_shapes(slide)) - len(images)
        if not images:
            skipped.append(slide_number)
            continue
        shape = max(images, key=lambda item: item.width * item.height)
        index = len(records) + 1
        stem = f'{index:02d}'
        source_image = image_for_shape(shape).convert('RGB')
        if max(source_image.size) > 3000:
            scale = 3000 / max(source_image.size)
            source_image = source_image.resize((round(source_image.width*scale), round(source_image.height*scale)), Image.Resampling.LANCZOS)
        names = {'src':f'{stem}_medium.webp','thumbnail':f'{stem}_thumb.webp','medium':f'{stem}_medium.webp','large':f'{stem}_large.webp','original':f'{stem}_original.webp'}
        webp_variant(source_image, 400, out_dir / names['thumbnail'])
        webp_variant(source_image, 1024, out_dir / names['medium'])
        webp_variant(source_image, 2048, out_dir / names['large'])
        webp_variant(source_image, 3000, out_dir / names['original'])
        candidates = caption_candidates(slide)
        caption = max(candidates, key=lambda text: (
            bool(parse_caption(text)['artist'] and parse_caption(text)['title']),
            bool(re.search(r'(?:18|19|20)\d{2}', text)),
            bool(re.search(r'\.\s+[А-ЯЁA-Z«\[]', text)), len(text)), default='')
        fields = parse_caption(caption)
        record = {'id':f'p{index:02d}',**names,**fields,'caption':caption,'themeOrder':None}
        previous = by_id.get(record['id'], {})
        record.update({key:value for key,value in previous.items() if key not in names and key not in {'id','artist','artistShort','title','year','caption'}})
        records.append(record)
    discover_theme_orders(records)
    (ROOT / 'src/data/paintings.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return records, skipped, duplicate_count


def write_task_deck() -> tuple[list[int], int]:
    deck = Presentation(TASK_DECK)
    assets = ROOT / 'public/assets/tasks'
    assets.mkdir(parents=True, exist_ok=True)
    markdown = ['# Слайды с заданиями', '', 'Текст ниже извлечён из `source/Игра задания.pptx`; изображения слайдов сохранены в `public/assets/tasks/` as optimized WebP images.', '']
    skipped = []
    saved = 0
    for slide_number, slide in enumerate(deck.slides, start=1):
        markdown.extend([f'## Слайд {slide_number}', ''])
        slide_text = [clean_text(shape.text) for shape in slide.shapes
                      if shape.has_text_frame and clean_text(shape.text)]
        markdown.append('\n\n'.join(slide_text) if slide_text else '_Текст отсутствует._')
        markdown.append('')
        images = unique_images(slide)
        if not images:
            skipped.append(slide_number)
        for image_number, shape in enumerate(images, start=1):
            image = image_for_shape(shape)
            image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
            image.save(assets / f's{slide_number}_{image_number}.webp', 'WEBP', quality=88, method=6)
            saved += 1
    (ROOT / 'tools/tasks-slides.md').write_text('\n'.join(markdown).rstrip() + '\n', encoding='utf-8')
    return skipped, saved


def convex_hull(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts
    def cross(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def shape_endpoints(shape) -> tuple[tuple[float, float], tuple[float, float]]:
    xfrm = shape._element.spPr.xfrm
    flip_h, flip_v = xfrm.get('flipH') == '1', xfrm.get('flipV') == '1'
    x, y, w, h = shape.left, shape.top, shape.width, shape.height
    start = (x + (w if flip_h else 0), y + (h if flip_v else 0))
    end = (x + (0 if flip_h else w), y + (0 if flip_v else h))
    return start, end


def relative(point, shape) -> tuple[float, float]:
    return ((point[0] - shape.left) / shape.width, (point[1] - shape.top) / shape.height)


def zone_overlay(shape, points: list[tuple[float, float]], output: Path):
    image = image_for_shape(shape).convert('RGBA')
    polygon = [(round(x * image.width), round(y * image.height)) for x, y in points]
    overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.polygon(polygon, fill=(255, 0, 0, 86), outline=(255, 40, 30, 245), width=max(3, image.width // 250))
    image.alpha_composite(overlay)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.convert('RGB').save(output, 'PNG', optimize=True)


def write_zones() -> tuple[bool, list[Path]]:
    deck = Presentation(TASK_DECK)
    crown_slide = deck.slides[11]
    crown_picture = next(shape for shape in crown_slide.shapes if shape.name == 'Picture 2')
    segments = [shape_endpoints(shape) for shape in crown_slide.shapes if shape.shape_type == MSO_SHAPE_TYPE.LINE]
    counts: dict[tuple[int, int], int] = {}
    for start, end in segments:
        for x, y in (start, end):
            key = (round(x / 25000), round(y / 25000))
            counts[key] = counts.get(key, 0) + 1
    open_contour = any(count == 1 for count in counts.values())
    all_points = [point for segment in segments for point in segment]
    all_points = [(round(x / 1000) * 1000, round(y / 1000) * 1000) for x, y in all_points]
    hull_abs = convex_hull(all_points) if open_contour else [segments[0][0]]
    if not open_contour:
        # Trace connected segments into polygon points when the outline is closed.
        adjacency: dict[tuple[int, int], list[tuple[int, int]]] = {}
        coords: dict[tuple[int, int], tuple[float, float]] = {}
        for a, b in segments:
            ka, kb = (round(a[0]/25000), round(a[1]/25000)), (round(b[0]/25000), round(b[1]/25000))
            adjacency.setdefault(ka, []).append(kb); adjacency.setdefault(kb, []).append(ka)
            coords[ka] = a; coords[kb] = b
        start = next(iter(adjacency)); current = start; previous = None; hull_abs = []
        while True:
            hull_abs.append(coords[current])
            following = next((v for v in adjacency[current] if v != previous), None)
            if following is None or following == start:
                break
            previous, current = current, following
    crown_points = [relative(point, crown_picture) for point in hull_abs]

    figure_slide = deck.slides[12]
    figure_picture = next(shape for shape in figure_slide.shapes if shape.name == 'Рисунок 10')
    figure = next(shape for shape in figure_slide.shapes if shape.name == 'Прямоугольник 4')
    figure_points = [relative((x, y), figure_picture) for x, y in [
        (figure.left, figure.top), (figure.left + figure.width, figure.top),
        (figure.left + figure.width, figure.top + figure.height), (figure.left, figure.top + figure.height),
    ]]
    zones = {'crown': {'paintingId': 'p25', 'points': crown_points},
             'figure': {'paintingId': 'p19', 'points': figure_points}}
    (ROOT / 'src/data/zones.json').write_text(json.dumps({'zones': zones}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    paths = [ROOT / 'tools/zones-check/crown.png', ROOT / 'tools/zones-check/figure.png']
    zone_overlay(crown_picture, crown_points, paths[0])
    zone_overlay(figure_picture, figure_points, paths[1])
    return open_contour, paths


def copy_audio_sources() -> None:
    audio_dir = SOURCE / 'audio'
    output_dir = ROOT / 'public/assets/audio'
    if not audio_dir.is_dir():
        return
    output_dir.mkdir(parents=True, exist_ok=True)
    sources = [path for path in audio_dir.glob('*.mp3')]
    mappings = {
        'boris.mp3': 'борис годунов',
        'oprichnik.mp3': 'опричник',
        'kalashnikov.mp3': 'купец калашников',
    }
    for target, needle in mappings.items():
        source = next((path for path in sources if needle in normalized(path.stem)), None)
        if source:
            shutil.copyfile(source, output_dir / target)


def main():
    for path in (PAINTING_DECK, THEME_DECK, TASK_DECK):
        if not path.exists():
            raise FileNotFoundError(f'Не найдена презентация: {path}')
    (ROOT / 'src/data').mkdir(parents=True, exist_ok=True)
    paintings, skipped_paintings, duplicates = write_paintings()
    skipped_tasks, task_images = write_task_deck()
    open_contour, zone_paths = write_zones()
    copy_audio_sources()
    audio = [
        {'id': 'boris', 'src': 'boris.mp3', 'title': 'Борис Годунов', 'composer': 'Мусоргский', 'preload': 'none'},
        {'id': 'oprichnik', 'src': 'oprichnik.mp3', 'title': 'Опричник', 'composer': 'Чайковский', 'preload': 'none'},
        {'id': 'kalashnikov', 'src': 'kalashnikov.mp3', 'title': 'Купец Калашников', 'composer': 'Рубинштейн', 'preload': 'none'},
    ]
    (ROOT / 'src/data/audio.json').write_text(json.dumps(audio, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'src/data/halls.json').write_text('[]\n', encoding='utf-8')
    (ROOT / 'src/data/links.json').write_text('[]\n', encoding='utf-8')
    (ROOT / 'src/data/tasks.json').write_text('[]\n', encoding='utf-8')
    (ROOT / 'src/data/hints.json').write_text('[]\n', encoding='utf-8')
    (ROOT / 'src/data/libretto-lines.json').write_text('[]\n', encoding='utf-8')
    print(json.dumps({
        'paintings': len(paintings),
        'unparsedCaptions': sum(not p['artist'] or not p['title'] for p in paintings),
        'themeUnmatched': sum(p['themeOrder'] is None for p in paintings),
        'skippedPaintingSlides': skipped_paintings,
        'duplicatePaintingPicturesSkipped': duplicates,
        'taskSlides': len(Presentation(TASK_DECK).slides),
        'taskImages': task_images,
        'taskSlidesWithoutImages': skipped_tasks,
        'openCrownContour': open_contour,
        'zoneChecks': [str(path.relative_to(ROOT)) for path in zone_paths],
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
