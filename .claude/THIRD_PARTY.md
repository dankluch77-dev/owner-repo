# Сторонние материалы

Агенты в `.claude/agents/` и скиллы в `.claude/skills/` взяты из репозитория
[affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code)
(коммит `ef648e01899ba3e8dc6371642deaaf64b4477775`, версия 2.2.3), лицензия MIT.

Отобрано выборочно, не весь набор:
- агенты: planner, architect, code-reviewer, typescript-reviewer, security-reviewer, build-error-resolver;
- скиллы: santa-method, gan-style-harness, eval-harness, cost-aware-llm-pipeline,
  taste-distillation, taste-application, video-editing.

Изменения: у planner, code-reviewer и typescript-reviewer смягчено описание
(убраны «MUST BE USED» / «PROACTIVELY»), чтобы агенты не запускались на каждую правку.

Генерация в taste-application рассчитана на fal.ai; у нас генерация идёт через Higgsfield,
поэтому из неё берём измерение стиля (LUT, ритм монтажа), грейд и сборку.

---

MIT License

Copyright (c) 2026 Affaan Mustafa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
