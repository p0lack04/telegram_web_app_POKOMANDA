# Аудит и схема Claude Code

Дата: 2026-11-13. Claude Code: 2.1.323. Scope: checked-in `CLAUDE.md`, `.claude/rules`, `.claude/agents`, `.claude/skills`; пользовательские settings и секреты не изменялись.

## Модельная схема

Основная сессия остаётся `opus`: архитектура, сложные требования, решения, итоговый контроль и небольшие задачи, где делегирование дороже.

| Сценарий | Выбор |
|---|---|
| Архитектура/сложные требования/итоговый контроль | Opus, главная сессия |
| Backend/frontend, миграции, тесты, docs | `implementation` → Sonnet |
| Простое read-only исследование/поиск/классификация | `quick-scout` → Haiku |
| Auth/RBAC/PII/files/integrations review | `security-reviewer` → Sonnet; Opus контролирует высокий риск |
| QA-план или выполнение проверок | Главная сессия либо `implementation`; отдельный агент только для независимого scope |

Это рекомендации, не автоматическое переключение модели: Claude Code 2.1.323 не получает из проектного `CLAUDE.md` маршрутизатор задач. Алиасы `opus`, `sonnet`, `haiku` поддерживаются frontmatter Claude Code. Полное разрешение алиасов и коэффициенты Tooken требуют проверки в реальной сессии; env и base URL намеренно не менялись.

## Судьба старых агентов

- `architect.md` — удалён: архитектура остаётся у главной Opus-сессии.
- `backend-specialist.md` — удалён: backend реализация объединена с `implementation`/Sonnet.
- `frontend-specialist.md` — удалён: frontend реализация объединена с `implementation`/Sonnet; UX-знания сохранены в `ui-ux-redesign`.
- `qa-specialist.md` — удалён: QA выполняется главной сессией или исполнителем по scope; правила сохранены в `qa-testing`.
- `security-reviewer.md` — сохранён как независимый Sonnet read-only review: auth, object/field RBAC, PII, files и integrations дают существенную независимую ценность.
- Добавлены `implementation.md` и `quick-scout.md`. Первый изменяет только порученный scope; второй имеет только Read/Grep/Glob и не может менять файлы или принимать security/architecture решения.

## Судьба skills

Все девять сохранены: области не дублируют друг друга настолько, чтобы безопасно слить их без потери качества.

| Skill | Решение | Причина |
|---|---|---|
| `backend-api` | сохранить | API layers, Zod, DTO, transactions, integration tests |
| `code-review` | сохранить | независимый checklist diff/security/architecture |
| `database-prisma` | сохранить | cardinality, constraints, indexes, migrations, SurveySubmission/files |
| `imports-files-integrations` | сохранить | CSV/XLSX preview, Google access, storage, bot delivery |
| `project-audit` | сохранить, только по триггеру | полный аудит нужен при неизвестной/изменившейся структуре, не всегда |
| `qa-testing` | сохранить | auth/RBAC/onboarding/import/files/survey/DailyMark negative matrix |
| `rbac-security` | сохранить | scope-first, object/field permissions, PII and file controls |
| `telegram-mini-app` | сохранить | raw initData, WebApp lifecycle, safe areas and auth adapter |
| `ui-ux-redesign` | сохранить | role/task map, mobile/a11y/loading/error states |

Skills уже компактны и содержат уникальные знания. Основной файл больше не повторяет их чек-листы; он содержит только маршрутизацию и критичные invariants.

## Проверка совместимости

- Frontmatter использует документированные поля: `name`, `description`, `model`, `tools`, `disallowedTools`.
- Алиасы: `opus`, `sonnet`, `haiku`; полные provider IDs не добавлялись.
- `quick-scout` не имеет `Edit`, `Write`, `Bash`, `Agent` или `Skill`.
- `security-reviewer` имеет только Read/Grep/Glob; без Bash, Skill, MCP и пишущих инструментов. Исполняемые проверки рекомендует главной сессии.
- Skills не предзагружаются агентам: они выбираются по задаче, чтобы не платить контекст за нерелевантные инструкции.
- Проектного `.claude/settings.json`, hooks, MCP-конфигурации и env overrides не было; новые settings не создавались. Главная модель/`ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` не менялись.
- `gh` отсутствует в PATH, поэтому PR через GitHub CLI не может быть создан из этой сессии без установки/авторизации.

## Ожидаемая экономия

1. `CLAUDE.md` сокращён с 156 строк до компактного набора контекста, invariants, security, workflow и routing; исторические детали и повторяющиеся skill-чек-листы вынесены из постоянно загружаемого контекста.
2. Полный аудит/TXT теперь запускается по триггеру, а не для каждой механической задачи.
3. Sonnet выполняет большую часть реализации, Haiku — дешёвый read-only scout; Opus не тратится на механические изменения и не создаются пять одинаковых специализированных исполнителей.
4. Read-only ограничения уменьшают риск лишнего контекста/изменений и делают независимый review полезнее.
5. `CLAUDE.md` явно запрещает повторное чтение больших документов, дампы кода и параллельный fan-out без выгоды.

Количественную экономию в деньгах не заявляю: в проекте нет usage/cost telemetry, а запуск реальных модельных проб у Tooken был бы платным и не запрошен.

## Ограничения Tooken

Проверено только наличие Claude Code 2.1.323 и поддержку алиасов локальным CLI/frontmatter. Без безопасного отдельного запроса к каталогу Tooken нельзя подтвердить, что его gateway принимает именно эти алиасы, как он маршрутизирует Sonnet/Haiku и применяет коэффициенты. Следующая проверка — отдельная недорогая сессия с `/model` или эквивалентным безопасным list/metadata запросом, без изменения env и без продуктовых вызовов. Если gateway требует полные IDs, добавлять их следует только после документированного ответа Tooken.

## Проверки этого этапа

Выполнены до изменений: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — PASS; 99 backend + 25 frontend tests. После изменений: lint/typecheck/test/build PASS (99 backend + 25 frontend tests), npm run test:browser PASS (real API/PostgreSQL). node scripts/check-claude-config.mjs, node --check и git diff --check PASS. Install не требовался; схема/миграции не менялись.

## Измерение и оговорки
CLAUDE.md: 13 097 → 9 014 символов (−31%); Git rules: 3 653 → 2 584 (−29%); суммарно 16 750 → 11 598 (−31%). Это символы, не точный токенизатор и не измерение счёта. Коэффициенты Tooken 1.9x/1.3x/0.7x — сведения пользователя, не проверенный прайс.

Все 3 TXT, 5 старых агентов, 9 skills, единственный rule и актуальные context/matrix/architecture/database/permissions/log прочитаны полностью. Новых settings, hooks, MCP, env overrides и model ID не добавлено. Проверка frontmatter — статический проектный контракт, не полная внутренняя схема клиента. Aliases/tools подтверждены официальной документацией https://code.claude.com/docs/en/sub-agents (2026-11-13); локально подтверждены версия/CLI help, не реальные model requests. В новой сессии проверить /agents, /model, затем только с разрешением на платный smoke — Sonnet/Haiku и actual model/billing в Tooken.

## Аудит по исходным местам
| Место до изменений | Наблюдение | Решение |
|---|---|---|
| CLAUDE.md:7–17 | Историческое отсутствие структуры против рабочего workspace | Актуальный стек, готовность в матрице |
| CLAUDE.md:19–25,135,145 | Полное чтение перед любой задачей против scope-first | Полные TXT для нового аудита/пересмотра архитектуры; локально нужные разделы |
| CLAUDE.md:62,65; database-prisma:14 | DailyMark/SurveySubmission ещё как вопросы, но ADR уже утверждён | Утверждённые unique/timezone/FK |
| project-audit:17 | Устаревшие пути документов | FEATURE_MATRIX/ARCHITECTURE/LOG без копий |
| agents/*.md:1–5 | Нет model/tools, дублирование skills | Явные aliases и 3 узкие роли |
| git-workflow:88 | Фиксированная ветка прошлого этапа | Только историческая область этапа 2 |

Эти findings высокой уверенности подтверждаются текущими документами/manifest и явными требованиями пользователя. Не обнаружено специфичных устаревших thinking/API параметров: request-building code вне scope.

## Знания и стоимость agents/skills
Старые architect/backend/frontend/QA не содержат уникальных знаний вне CLAUDE и профильных skills: архитектурная миграция демо, API validation/transactions/DTO, mobile/Telegram/states, общий список QA. Каждый запуск добавляет отдельный контекст и отчёт; architect остаётся главной сессии, остальные объединены. Security checklist также пересекается со skills, но независимый adversarial взгляд оправдывает отдельную роль только после рискованных auth/RBAC/PII/files изменений.

| Skill | Уникальное относительно общего CLAUDE / когда применять | Дублирование / действие |
|---|---|---|
| backend-api | API layers/envelope/pagination/DTO, при API change | auth/transactions общие; сохранить |
| code-review | review diff, severity, согласованность слоёв | DoD/QA общие; сохранить |
| database-prisma | ownership/cardinality/index/cascade/rollback, при schema/SQL | role/security общие; уточнён |
| imports-files-integrations | preview/confirm/formula injection/Google/orphan cleanup/webhook/retry | auth/PII общие; сохранить |
| project-audit | полная функциональная матрица/симуляции, только аудит или новая структура | baseline общий; сужен trigger, исправлены пути |
| qa-testing | negative test matrix, при QA/regression/release | общие checks; baseline по scope, уточнён timezone |
| rbac-security | IDOR/field policies/CSRF/CORS/output encoding, при auth/PII | общий scope-first; сохранить |
| telegram-mini-app | lifecycle adapter/browser fallback/viewport/back cleanup, при WebApp change | общая auth/UI; сохранить |
| ui-ux-redesign | tokens/navigation/44px/focus/contrast, при UX change | общие states/a11y; локальный scope без полного redesign |

Descriptions постоянно присутствуют в каталоге, тела skills читаются по необходимости. Удаление маленького файла не экономит модельный вызов само по себе. Несвязанные области не объединены.

## Явные изменения процесса
Полная инвентаризация/TXT не требуются для каждой механической задачи; требования/источники сохранены. После малого diff — целевые проверки, перед сдачей — полный необходимый набор. Config/docs-only может использовать профильные проверки (в этой задаче дополнительно выполнен весь baseline/browser). Commit/push/PR требует разрешения задачи. Продолжение существующей chore-ветки и удаление legacy agents отдельно согласованы пользователем; чужой вложенный gitlink не включается. Продуктовые решения и roadmap не менялись.
