# neverfilmed — брендинг Instagram

Блог: англоязычные Reels без лица. Ниша — AI-видео и AI-инструменты: кинематографичные ролики, туториалы, промпты, тесты и сравнения инструментов.

## Логотип (аватарка)

Загружать файл 1080×1080. Instagram сам обрежет его в круг, всё важное уже внутри круга.

| Файл | Идея | Мелкий размер |
|---|---|---|
| `logo-1-viewfinder.png` ⭐ | Рамка видоискателя + закатное солнце: «кадр без камеры» | читается отлично |
| `logo-2-monogram.png` | Монограмма `nf.` в стиле киностудии | читается хорошо |
| `logo-3-film-frame.png` | Пустой кадр плёнки с закатом | в 44 px сливается |

Превью: `preview-avatar-sizes.png` (профиль / лента / комментарии, светлая и тёмная тема), `preview-profile-dark.png` / `preview-profile-light.png` (шапка целиком).

Палитра: чёрный `#0A0A0B`, кремовый `#F3EDE2`, янтарный `#F29A3A` → `#FFC266`.

## Шапка профиля

**Поле «Имя»** (до 64 символов, участвует в поиске):
- `Neverfilmed | AI Video & AI Tools` — обе части темы, ключевые слова для поиска (рекомендую)
- `Neverfilmed | AI Video & Tools` — короче

**Категория:** Digital creator

**Описание** (до 150 символов). Вариант A, 127 символов, рекомендую:
```
Cinematic AI video + the tools that make it 🎬
Tutorials • prompts • honest tool tests
Follow to create what was never filmed ↓
```

Вариант B, 119 символов, упор на обзоры инструментов:
```
AI video tools, tested so you don't have to 🎬
Prompts, tutorials & side-by-side comparisons
Follow for the next drop ↓
```

Вариант C, 100 символов, на этап, когда пойдут интеграции:
```
AI video & AI tools: tested, compared, explained
Prompts • tutorials • reviews
📩 Collabs: tap Email
```

**Кнопки:** включить кнопку «Email» с почтой блога (для брендов).

## Пересборка

Исходники в `src/`. После правок:
```
cd blog/brand/src && npm install && npm run render
```
