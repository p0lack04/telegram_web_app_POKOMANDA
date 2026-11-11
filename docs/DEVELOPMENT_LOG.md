# Журнал разработки

## 2026-11-11 — начало этапа 2
- Проверены чистый status, main == origin/main f084151 после fetch; создана feat/shift-applications.
- Foundation не переписывается. Baseline: lint/typecheck/build PASS, 66 backend + 6 frontend tests PASS.
- Существующие FEATURE-MATRIX и DECISIONS перенесены в FEATURE_MATRIX и ARCHITECTURE без дублирования; созданы context/database/permissions и этот журнал.
- Git workflow уже существует, прочитан; используется logical commit + push, без merge/force.
- GitHub CLI отсутствует в PATH; создание PR требует подготовить CLI и проверить авторизацию.
- Исходные TXT отсутствуют в актуальном дереве; прежний отчёт foundation остаётся историческим.

## Backend заявок и назначений
- Добавлены StaffingService/domain policies/роуты: submission, own/all lists, decisions version-CAS, recruitment/stage, candidates/manual admission, roles, history, in-app inbox.
- Аддитивная migration 202611110002_staffing: Application.version и индексы. Upgrade foundation с существующими User/Shift/Application проверен без потери данных.
- Проверки: Prisma validate (с тестовым DATABASE_URL), generate, lint/typecheck/build PASS; backend 95 tests PASS. Первый прогон staffing-теста имел неверное ожидание 403 от уже назначенного руководителя, исправлена test identity, production-права не ослаблялись.
- Новые production-сценарии ещё ожидают frontend/browser acceptance; backend commit не означает готовность всего этапа.
