import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataRoot = path.join(root, 'src/data');
const errors: string[] = [];
const chapterTexts = new Map<string, string>();
const chapterParagraphOrder = new Map<string, string[]>();

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch (error) {
    errors.push(`Не удалось прочитать JSON ${path.relative(root, file)}: ${String(error)}`);
    return null;
  }
}

function collectJsonFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJsonFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.json') ? [fullPath] : [];
  });
}

function addChapterParagraphs(chapterId: string, file: string): string[] | null {
  const raw = readJson(file);
  if (!isObject(raw) || raw.id !== chapterId || !Array.isArray(raw.paragraphs)) {
    errors.push(`Глава ${chapterId}: некорректная структура ${path.relative(root, file)}`);
    return null;
  }
  const ids: string[] = [];
  for (const [index, paragraph] of raw.paragraphs.entries()) {
    if (!isObject(paragraph) || typeof paragraph.id !== 'string' || typeof paragraph.text !== 'string') {
      errors.push(`Глава ${chapterId}: абзац ${index + 1} должен содержать строковые id и text.`);
      continue;
    }
    ids.push(paragraph.id);
    chapterTexts.set(paragraph.id, paragraph.text);
  }
  chapterParagraphOrder.set(chapterId, ids);
  return ids;
}

const publicIndexPath = path.join(dataRoot, 'texts/texts-index.json');
const publicIndex = readJson(publicIndexPath);
const manifestPath = path.join(root, 'tools/texts-id-manifest.json');
const manifest = readJson(manifestPath);

if (!isObject(publicIndex) || !Array.isArray(publicIndex.books) || publicIndex.books.length === 0) {
  errors.push('src/data/texts/texts-index.json должен содержать непустой массив books.');
}
if (!isObject(manifest) || !Array.isArray(manifest.books)) {
  errors.push('tools/texts-id-manifest.json должен содержать массив books для проверки ID абзацев.');
}

const indexBooks = isObject(publicIndex) && Array.isArray(publicIndex.books)
  ? publicIndex.books.filter(isObject)
  : [];
const manifestBooks = isObject(manifest) && Array.isArray(manifest.books)
  ? manifest.books.filter(isObject)
  : [];
const indexBookIds = new Set<string>();
const indexChapterIds = new Set<string>();
const manifestChapterIds = new Set<string>();
const manifestParagraphIds = new Set<string>();

for (const book of indexBooks) {
  if (typeof book.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(book.id)) {
    errors.push(`Некорректный id книги в texts-index.json: ${String(book.id)}`);
    continue;
  }
  if (indexBookIds.has(book.id)) errors.push(`Повторяется id книги: ${book.id}`);
  indexBookIds.add(book.id);
  if (typeof book.title !== 'string' || !book.title.trim()) errors.push(`У книги ${book.id} нет заголовка.`);
  if (!Array.isArray(book.chapters)) {
    errors.push(`У книги ${book.id} отсутствует массив chapters.`);
    continue;
  }
  for (const chapter of book.chapters.filter(isObject)) {
    const id = chapter.id;
    if (typeof id !== 'string' || !id.startsWith(`${book.id}-`) || !/^[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}$/.test(id)) {
      errors.push(`Некорректный id главы книги ${book.id}: ${String(id)}`);
      continue;
    }
    if (indexChapterIds.has(id)) errors.push(`Повторяется id главы: ${id}`);
    indexChapterIds.add(id);
    if (typeof chapter.title !== 'string' || !chapter.title.trim()) errors.push(`У главы ${id} нет заголовка.`);
  }
}

for (const book of manifestBooks) {
  if (typeof book.id !== 'string' || !Array.isArray(book.chapters)) {
    errors.push('В texts-id-manifest.json найдена книга без id или chapters.');
    continue;
  }
  if (!indexBookIds.has(book.id)) errors.push(`Книга ${book.id} есть в manifest, но отсутствует в texts-index.`);
  for (const chapter of book.chapters.filter(isObject)) {
    const id = chapter.id;
    if (typeof id !== 'string' || !indexChapterIds.has(id)) {
      errors.push(`Глава ${String(id)} из manifest отсутствует в texts-index.`);
      continue;
    }
    if (manifestChapterIds.has(id)) errors.push(`Повторяется id главы в manifest: ${id}`);
    manifestChapterIds.add(id);
    if (!Array.isArray(chapter.paragraphIds) || chapter.paragraphIds.length === 0) {
      errors.push(`У главы ${id} нет paragraphIds в manifest.`);
      continue;
    }
    const chapterSequence = id.slice(-3);
    const bookId = id.slice(0, -(chapterSequence.length + 1));
    const localIds = new Set<string>();
    for (const paragraphId of chapter.paragraphIds) {
      if (typeof paragraphId !== 'string' || !new RegExp(`^t-${bookId}-${chapterSequence}-\\d{4}$`).test(paragraphId)) {
        errors.push(`Некорректный id абзаца в главе ${id}: ${String(paragraphId)}`);
        continue;
      }
      if (localIds.has(paragraphId) || manifestParagraphIds.has(paragraphId)) errors.push(`Повторяется id абзаца: ${paragraphId}`);
      localIds.add(paragraphId);
      manifestParagraphIds.add(paragraphId);
    }
    const localChapterPath = path.join(root, `tools/_chapters/${id}.json`);
    const publicChapterPath = path.join(dataRoot, `texts/${id}.json`);
    const chapterPath = existsSync(publicChapterPath) ? publicChapterPath : localChapterPath;
    if (existsSync(chapterPath)) {
      const actualIds = addChapterParagraphs(id, chapterPath);
      if (actualIds && (actualIds.length !== chapter.paragraphIds.length || actualIds.some((p, i) => p !== chapter.paragraphIds?.[i]))) {
        errors.push(`Список абзацев в ${path.relative(root, chapterPath)} расходится с manifest.`);
      }
    }
  }
}
for (const id of indexChapterIds) {
  if (!manifestChapterIds.has(id)) errors.push(`Глава ${id} отсутствует в texts-id-manifest.json.`);
}

const audioPath = path.join(dataRoot, 'audio.json');
const audioData = readJson(audioPath);
if (!Array.isArray(audioData) || audioData.length !== 3) {
  errors.push('src/data/audio.json должен содержать ровно три аудиозаписи.');
} else {
  const files = new Set<string>();
  for (const [index, entry] of audioData.entries()) {
    if (!isObject(entry) || typeof entry.file !== 'string' || typeof entry.opera !== 'string'
      || typeof entry.title !== 'string' || typeof entry.composer !== 'string'
      || typeof entry.durationSec !== 'number' || entry.durationSec <= 0
      || typeof entry.sourceFile !== 'string' || typeof entry.startSec !== 'number' || entry.startSec < 0) {
      errors.push(`Некорректная запись audio.json №${index + 1}.`);
      continue;
    }
    if (files.has(entry.file)) errors.push(`Повторяется файл в audio.json: ${entry.file}`);
    files.add(entry.file);
    const assetPath = path.join(root, 'public/assets/audio', entry.file);
    if (!existsSync(assetPath)) errors.push(`Аудиофайл из audio.json отсутствует: public/assets/audio/${entry.file}`);
    else if (readFileSync(assetPath).byteLength > 5 * 1024 * 1024) {
      errors.push(`Аудиофайл превышает лимит 5 МБ: public/assets/audio/${entry.file}`);
    }
  }
}

// Initial JSON payload includes root-level game data and the text catalog.
// Per-chapter text JSON is lazy-loaded and is intentionally excluded.
const startupJsonFiles = collectJsonFiles(dataRoot).filter((file) => {
  const relative = path.relative(dataRoot, file).split(path.sep).join('/');
  return !relative.startsWith('texts/') || relative === 'texts/texts-index.json';
});
const startupBytes = startupJsonFiles.reduce((total, file) => total + readFileSync(file).byteLength, 0);
const startupLimitBytes = 300 * 1024;
if (startupBytes > startupLimitBytes) {
  errors.push(`Стартовые JSON-данные занимают ${startupBytes} байт, лимит ${startupLimitBytes}.`);
}

function checkReferences(value: unknown, source: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => checkReferences(entry, source));
    return;
  }
  if (!isObject(value)) return;
  const paragraphRefKeys = /(?:paragraph|textParagraph)(?:Id|_id)$/i;
  const chapterRefKeys = /(?:chapter|textChapter)(?:Id|_id)$/i;
  for (const [key, field] of Object.entries(value)) {
    if (typeof field === 'string' && paragraphRefKeys.test(key) && !manifestParagraphIds.has(field)) {
      errors.push(`${source}: ссылка на неизвестный id абзаца ${field}.`);
    }
    if (typeof field === 'string' && chapterRefKeys.test(key) && !indexChapterIds.has(field)) {
      errors.push(`${source}: ссылка на неизвестный id главы ${field}.`);
    }
    checkReferences(field, source);
  }
  const paragraphId = Object.entries(value).find(([key, field]) => paragraphRefKeys.test(key) && typeof field === 'string')?.[1];
  const quote = Object.entries(value).find(([key, field]) => /^(quote|excerpt|citation|line)$/i.test(key) && typeof field === 'string')?.[1];
  if (typeof paragraphId === 'string' && typeof quote === 'string') {
    const sourceText = chapterTexts.get(paragraphId);
    if (sourceText && !sourceText.includes(quote)) errors.push(`${source}: цитата не является подстрокой абзаца ${paragraphId}.`);
    if (!sourceText) errors.push(`${source}: для проверки цитаты ${paragraphId} нет тела опубликованной главы.`);
  }
}

for (const fileName of ['links.json', 'libretto-lines.json']) {
  const file = path.join(dataRoot, fileName);
  const value = readJson(file);
  if (Array.isArray(value) && value.length > 0) checkReferences(value, `src/data/${fileName}`);
  else if (isObject(value) && Object.keys(value).length > 0) checkReferences(value, `src/data/${fileName}`);
}

const paintings = readJson(path.join(dataRoot, 'paintings.json'));
const links = readJson(path.join(dataRoot, 'links.json'));
const librettoLines = readJson(path.join(dataRoot, 'libretto-lines.json'));
const hints = readJson(path.join(dataRoot, 'hints.json'));
const halls = readJson(path.join(dataRoot, 'halls.json'));
const tasks = readJson(path.join(dataRoot, 'tasks.json'));
if (!Array.isArray(paintings) || !Array.isArray(links)) {
  errors.push('paintings.json и links.json должны быть массивами.');
} else {
  const linkedPaintings = new Set<string>();
  for (const [index, entry] of links.entries()) {
    if (!isObject(entry) || !['high', 'medium', 'low'].includes(String(entry.confidence))
      || typeof entry.reason !== 'string' || !entry.reason.trim()) {
      errors.push(`Некорректная связь №${index + 1}: нужны confidence и reason.`);
      continue;
    }
    if (typeof entry.paintingId === 'string') {
      if (!paintings.some((painting) => isObject(painting) && painting.id === entry.paintingId)) {
        errors.push(`Связь №${index + 1}: неизвестная картина ${entry.paintingId}.`);
      }
      linkedPaintings.add(entry.paintingId);
    }
    if (entry.paragraphId === null) {
      if (entry.confidence !== 'low' || entry.quote !== '') errors.push(`Связь №${index + 1}: без абзаца допустимы только confidence low и пустая quote.`);
    } else if (typeof entry.quote !== 'string' || entry.quote.length > 200) {
      errors.push(`Связь №${index + 1}: цитата должна быть строкой не длиннее 200 символов.`);
    }
    if (typeof entry.paintingId === 'string' && typeof entry.paragraphId === 'string') {
      if (entry.headingText !== undefined && (typeof entry.headingText !== 'string' || !entry.headingText.trim())) {
        errors.push(`Связь №${index + 1}: headingText должен быть непустой строкой.`);
      }
      const chapterId = typeof entry.chapterId === 'string' ? entry.chapterId : '';
      const order = chapterParagraphOrder.get(chapterId);
      const startIndex = order?.indexOf(entry.paragraphId) ?? -1;
      const endParagraphId = entry.endParagraphId === undefined ? entry.paragraphId : entry.endParagraphId;
      const endIndex = typeof endParagraphId === 'string' ? order?.indexOf(endParagraphId) ?? -1 : -1;
      if (typeof endParagraphId !== 'string' || endIndex < 0) {
        errors.push(`Связь №${index + 1}: endParagraphId ${String(endParagraphId)} отсутствует в главе ${chapterId}.`);
      } else if (startIndex < 0 || endIndex < startIndex) {
        errors.push(`Связь №${index + 1}: endParagraphId должен быть в той же главе и не раньше paragraphId.`);
      }
      if (entry.anchorQuote !== undefined) {
        const text = chapterTexts.get(entry.paragraphId);
        if (typeof entry.anchorQuote !== 'string' || !entry.anchorQuote.trim() || !text?.includes(entry.anchorQuote)) {
          errors.push(`Связь №${index + 1}: anchorQuote отсутствует в абзаце ${entry.paragraphId}.`);
        }
      }
    }
  }
  for (const painting of paintings.filter(isObject)) {
    if (typeof painting.id === 'string' && !linkedPaintings.has(painting.id)) errors.push(`Для картины ${painting.id} нет записи в links.json.`);
    if (typeof painting.hallId !== 'string' || typeof painting.theme !== 'string'
      || !['violence', 'tragedy', 'state', 'piety'].includes(String(painting.tone))) {
      errors.push(`У картины ${String(painting.id)} нет зала, темы или допустимого tone.`);
    }
  }
}
if (!Array.isArray(librettoLines) || librettoLines.length !== 18) {
  errors.push('libretto-lines.json должен содержать ровно 6 строк для каждой из трёх опер.');
} else {
  for (const opera of ['Борис Годунов', 'Опричник', 'Купец Калашников']) {
    if (librettoLines.filter((entry) => isObject(entry) && entry.opera === opera).length !== 6) {
      errors.push(`Для либретто «${opera}» требуется ровно 6 строк.`);
    }
  }
}
if (!Array.isArray(tasks) || !Array.isArray(hints) || hints.length !== tasks.length) {
  errors.push('Для каждого задания требуется отдельная запись в hints.json.');
} else {
  const taskIds = new Set(tasks.filter(isObject).map((task) => task.id).filter((id): id is string => typeof id === 'string'));
  const hinted = new Set<string>();
  const forbidden = /нажми|кликни|пойди|прочитай|перетащи|выбери/i;
  for (const entry of hints.filter(isObject)) {
    if (typeof entry.taskId !== 'string' || !taskIds.has(entry.taskId) || hinted.has(entry.taskId)
      || !Array.isArray(entry.hints) || entry.hints.length !== 3) {
      errors.push(`Некорректная запись подсказок для ${String(entry.taskId)}.`);
      continue;
    }
    hinted.add(entry.taskId);
    for (const [index, hint] of entry.hints.entries()) {
      if (!isObject(hint) || typeof hint.text !== 'string' || forbidden.test(hint.text)) {
        errors.push(`Подсказка ${entry.taskId}, уровень ${index + 1}: пустой текст или запрещённое слово.`);
      }
    }
    const last = entry.hints[2];
    if (isObject(last) && (typeof last.paragraphId !== 'string' || typeof last.text !== 'string'
      || !chapterTexts.get(last.paragraphId)?.includes(last.text))) {
      errors.push(`Подсказка ${entry.taskId}: третий уровень должен быть дословным фрагментом текста.`);
    }
    if (isObject(last) && Array.isArray(links)
      && !links.some((link) => isObject(link) && link.paragraphId === last.paragraphId && link.quote === last.text)) {
      errors.push(`Подсказка ${entry.taskId}: третий уровень должен ссылаться на дословную цитату из links.json.`);
    }
  }
}
if (Array.isArray(tasks)) {
  for (const task of tasks.filter(isObject)) {
    if (Array.isArray(task.links)) {
      for (const paragraphId of task.links) {
        if (typeof paragraphId !== 'string' || !manifestParagraphIds.has(paragraphId)) {
          errors.push(`Задание ${String(task.id)} ссылается на неизвестный абзац ${String(paragraphId)}.`);
        }
      }
    }
  }
}
if (!Array.isArray(halls) || halls.length !== 11 || !Array.isArray(paintings)) {
  errors.push('halls.json должен содержать 11 залов.');
} else {
  const assigned = new Set<string>();
  for (const hall of halls.filter(isObject)) {
    if (!Array.isArray(hall.paintingIds)) errors.push(`У зала ${String(hall.id)} отсутствует paintingIds.`);
    for (const id of Array.isArray(hall.paintingIds) ? hall.paintingIds : []) {
      if (typeof id !== 'string' || assigned.has(id)) errors.push(`Картина назначена более чем одному залу: ${String(id)}.`);
      assigned.add(String(id));
    }
  }
  for (const painting of paintings.filter(isObject)) {
    if (typeof painting.id === 'string' && !assigned.has(painting.id)) errors.push(`Картина ${painting.id} не включена ни в один зал.`);
  }
}

if (errors.length > 0) {
  console.error(`Проверка данных не пройдена (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const paragraphBodiesPresent = chapterTexts.size > 0;
  console.log(`Данные проверены: ${indexBookIds.size} книг, ${indexChapterIds.size} глав, ${manifestParagraphIds.size} id абзацев.`);
  console.log(`Стартовые JSON-данные: ${startupBytes}/${startupLimitBytes} байт; аудиозаписей: 3.`);
  if (!paragraphBodiesPresent) console.log('Тела локальных глав отсутствуют (пропущены); ID проверены по tools/texts-id-manifest.json.');
}
