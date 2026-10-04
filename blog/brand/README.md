# neverfilmed — брендинг Instagram

Блог: англоязычные Reels без лица, ниша — кинематографичное AI-видео.

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
- `Neverfilmed | Cinematic AI Video` — с ключевыми словами для поиска (рекомендую)
- `Neverfilmed | Cinematic Visuals` — без слова «AI»

**Категория:** Digital creator

**Описание** (до 150 символов). Вариант A — рекомендую:
```
Shots no camera ever filmed 🎬
Cinematic AI visuals + the prompts behind them
Follow for the next drop ↓
```

Вариант B — без слова «AI»:
```
Visuals that were never filmed.
Every shot comes with its secret 🎬
Follow for the next drop ↓
```

Вариант C — на этап, когда пойдут интеграции:
```
Cinematic visuals, zero cameras 🎬
Prompts • breakdowns • tools
📩 Collabs: tap Email
```

**Кнопки:** включить кнопку «Email» с почтой блога (для брендов).

## Пересборка

Исходники в `src/`. После правок:
```
cd blog/brand/src && npm install && npm run render
```
