# Контекст проекта «Команда»

Актуализировано: 2026-11-11, этап 2 реализован в PR [#3](https://github.com/p0lack04/telegram_web_app_POKOMANDA/pull/3), merge выполняет пользователь. Проверки: 99 backend + 25 frontend tests, lint/typecheck/build/browser PASS, npm audit 0.

## Отправная точка
Production Foundation объединён в main (PR #1). Перед этапом 2 main/origin/main = f084151; рабочее дерево чистое. Исходные TXT удалены из отслеживаемого Git tree предыдущими коммитами, но локальные `1.txt`, `2.txt`, `3.txt` в корне существуют и приоритетны как источник требований. Не изменять и не добавлять их обратно в Git без задачи.

## Стек и границы
React18/TS/Vite/TanStack Query; Fastify5/Zod/PostgreSQL/Prisma6; Vitest + embedded PostgreSQL и Playwright. Один backend, один workspace lockfile. Auth/onboarding/session/shift visibility уже работают; не переписывать.

## Где читать
- [Матрица](FEATURE_MATRIX.md) — готовность каждого сценария; перенесена из audit, не копия.
- [Архитектура](ARCHITECTURE.md) — существующие ADR; перенесена из architecture/DECISIONS.md.
- [БД](DATABASE.md) — владение данными и стратегия миграций.
- [Права](PERMISSIONS.md) — authority и ограничения второго этапа.
- [Журнал](DEVELOPMENT_LOG.md) — проверки и коммиты этапов.
- [README](../README.md) — запуск; [отчёт foundation](PHASE-1-REPORT.md) — исторический снимок, не текущий backlog.

## Этап 2: заявки и распределение
Реализация ведётся в feat/shift-applications. Scope: recruitment flags/stages, заявки/мои заявки/ADMIN decisions, принятый персонал/ручное добавление, должности, история и in-app notification. Не включает Squad CRUD, отмену участия/пересмотр закрытого решения, Telegram delivery worker, документы/программу/опросы.

Из исходных требований: LEAD_RECRUIT для LEAD, TRAINEE_RECRUIT для TRAINEE, независимые флаги набора, ADMIN принимает/отклоняет; должности per shift, несколько должностей одному человеку. Заместитель управляет должностями кроме руководителя. Принятие и должность — разные действия. Privacy: сотрудник читает только свои заявки/назначения; ADMIN управляет заявками; менеджер должностей читает минимальный список принятого персонала. Неподтверждённые аккаунты заблокированы.

Безопасные границы неоднозначностей: решения только PENDING→APPROVED/REJECTED, повторная заявка после решения не добавляется без согласования; ручное добавление ADMIN создаёт APPROVED admission и не обходит прежний REJECTED. Связь должности с отрядом допускается только при существующем членстве той же смены. Глобальная роль не меняется при назначении должности. Telegram delivery пока не работает — уведомление означает только запись в inbox.
