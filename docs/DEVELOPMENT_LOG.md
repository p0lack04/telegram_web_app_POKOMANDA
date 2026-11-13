# Журнал разработки

## 2026-11-11 — начало этапа 2
- Проверены чистый status, main == origin/main f084151 после fetch; создана feat/shift-applications.
- Foundation не переписывается. Baseline: lint/typecheck/build PASS, 66 backend + 6 frontend tests PASS.
- Существующие FEATURE-MATRIX и DECISIONS перенесены в FEATURE_MATRIX и ARCHITECTURE без дублирования; созданы context/database/permissions и этот журнал.
- Git workflow уже существует, прочитан; используется logical commit + push, без merge/force.
- GitHub CLI отсутствует в PATH; создание PR требует подготовить CLI и проверить авторизацию.
- Уточнение: TXT отсутствуют только в Git tree, но локальные файлы 1.txt/2.txt/3.txt существуют в корне. Разделы заявок и матрицы должностей сверены с локальными 1.txt:305–342 и 2.txt:299–318; предыдущее предположение об отсутствии файлов на диске исправлено.

## Backend заявок и назначений
- Добавлены StaffingService/domain policies/роуты: submission, own/all lists, decisions version-CAS, recruitment/stage, candidates/manual admission, roles, history, in-app inbox.
- Аддитивная migration 202611110002_staffing: Application.version и индексы. Upgrade foundation с существующими User/Shift/Application проверен без потери данных.
- Проверки: Prisma validate (с тестовым DATABASE_URL), generate, lint/typecheck/build PASS; backend 95 tests PASS. Первый прогон staffing-теста имел неверное ожидание 403 от уже назначенного руководителя, исправлена test identity, production-права не ослаблялись.
- Новые production-сценарии ещё ожидают frontend/browser acceptance; backend commit не означает готовность всего этапа.

## Исправление notification visibility
- Review выявил утечку названия скрытой смены через STAFFING inbox/mark-read. Миграция 202611110003_notification_scope добавляет nullable FK к Shift и индекс, без удаления данных.
- Scope проверяется при каждом чтении inbox и mark-read; legacy STAFFING без shiftId скрыты (надёжного backfill нет), общие ACCOUNT уведомления остаются доступны владельцу.
- Четыре regression tests: скрытие после отправки, новое отклонение уже скрытой заявки, смена глобальной роли при действующей сессии, legacy orphan-scope.
- Итог после исправления: 99 backend tests, 24 frontend tests, lint/typecheck/build/browser PASS.

## UI и browser acceptance
- Staffing.tsx подключён к деталям смены и профилю: подача, версии решений с подтверждением, набор/этап, manual admission, персонал/назначения, история/own inbox.
- Frontend разработан в изолированном worktree; patch проверен и применён в основном локальном checkout. После интеграции исправлены запрос staff без permission, доступные имена select и подписи history. History DTO дополнен минимальным subject summary, без контактов.
- Browser smoke использует настоящий API/PostgreSQL, синтетические сессии только в тестовой БД. Проверены apply/approve/reject/manual/assign/remove и deputy controls; screenshots просмотрены. Между независимыми группами теста перезапускается API для изоляции in-memory per-IP rate-limit store; production лимит не отключается.
- Неудачные browser-прогоны: неоднозначная подпись select; отсутствующий goto для нового контекста; substring match «Руководитель» захватывал «Руководитель тех группы»; исчерпание общего test-IP rate limit. Причины исправлены, проверки не удалены.
- Финал UI: lint/typecheck/build PASS, **99 backend + 25 frontend = 124 tests PASS**, browser PASS, npm audit **0 vulnerabilities**.

## Публикация этапа 2
- Ветка feat/shift-applications, PR [#3](https://github.com/p0lack04/telegram_web_app_POKOMANDA/pull/3) в main, без merge.
- Опубликованные логические коммиты: 60588fe (контекст), 6e11602 (API/миграция/тесты), ca2599b (notification scope fix), 4c17b72 (UI/browser), 07313ce (документация).
- Финальный snapshot: 124 tests PASS, browser PASS, lint/typecheck/build PASS, audit 0. Тестовые сервисы остановлены. Следующий функциональный этап — отряды/участники и полевые права; Telegram delivery остаётся отдельно.

## 2026-11-13 — конфигурация Claude Code
- Только конфигурация/docs: сокращены CLAUDE/Git rules, 5 agents → implementation/sonnet + quick-scout/haiku + security-reviewer/sonnet; 9 skills сохранены, 4 уточнены. Подробности: [аудит конфигурации](CLAUDE_CODE_CONFIG.md). Roadmap/продуктовые статусы/API/Prisma/UI не менялись.
- Ветка chore/claude-code-token-optimization уже существовала; пользователь подтвердил продолжение без переключения и исключение грязного вложенного gitlink. После fetch HEAD == origin/main. Удаление четырёх старых agent-файлов отдельно подтверждено.
- Финальные проверки: lint/typecheck/build PASS, 99 backend + 25 frontend tests PASS; browser smoke PASS (real API/PostgreSQL). Статический node scripts/check-claude-config.mjs PASS. Install не требовался, миграции не менялись.
- settings/env/секреты и пользовательская конфигурация не менялись; live Tooken routing/billing не проверены. gh отсутствует; PR требует доступного CLI/авторизации.
