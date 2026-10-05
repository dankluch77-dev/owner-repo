---
tags: [знания, claude-code, агенты, инструменты]
updated: 2026-10-05
source: https://github.com/affaan-m/everything-claude-code
---

# everything-claude-code

Открытый репозиторий **Affaan Mustafa**, победителя хакатона Anthropic × Forum Ventures. Это большой набор настроек для Claude Code: 68 агентов, 293 скилла, 94 команды, хуки (версия 2.2.3, лицензия MIT).

## Что мы взяли (лежит в `.claude/` репозитория)
- **Агенты для разработки** [[Студия агентов]]: planner, architect, code-reviewer, typescript-reviewer, security-reviewer, build-error-resolver. У трёх из них смягчено описание, чтобы не запускались на каждую правку.
- **Качество агентов:**
  - `santa-method`: два независимых проверяющих по одному чек-листу, выпуск только если оба «ок»;
  - `gan-style-harness`: генератор + оценщик в цикле;
  - `eval-harness`: как измерять надёжность агентов;
  - `cost-aware-llm-pipeline`: выбор модели по сложности задачи, бюджет.
- **Видео:**
  - `taste-distillation`: из роликов-референсов измеряет LUT и ритм монтажа;
  - `taste-application`: генерация, грейд и монтаж по стайл-паку (генерация там на fal.ai, у нас Higgsfield);
  - `video-editing`: FFmpeg, перекадровка 9:16.

## Что не взяли и почему
- Весь набор целиком: шум в контексте, 24 хука, дубли встроенных `/code-review` и Plan.
- `agent-eval`, `team-agent-orchestration`, `autonomous-loops`: первые два про программистских агентов, третий автор пометил устаревшим.

## Главные идеи
- Цвет нельзя получить промптом, его надо измерить и наложить. См. [[Правила генерации видео]].
- Генерировать дубли, а не отдельные планы.

Источник: `.claude/THIRD_PARTY.md`.
