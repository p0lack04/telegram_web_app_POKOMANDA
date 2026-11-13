# Roadmap до production

## Актуальный продуктовый срез — 2026-11-13

Foundation и этап 2 (заявки/допуск/должности) объединены в main. Нумерация ниже — исторические технические потоки, а не основание переименовывать текущий продуктовый этап 3 «Отряды, дети и участники».

Первый срез этапа 3 ограничен read-only списком и карточкой метаданных отрядов. D1/D2/D3/D14/D12 APPROVED: DTO id/name/color/sortOrder; view_all либо view_own с серверной связью через role/member; membership без permission не даёт доступа; несколько членств допустимы; скрытый/чужой detail 404, list без view permissions 403. Полный контракт — ADR-005 в [ARCHITECTURE](ARCHITECTURE.md).

Не входят и остаются следующими самостоятельными задачами: Squad CRUD, состав детей/сотрудников и count, Child CRUD/identity, распределение/переводы, membership lifecycle, архивация, комнаты/оплата/заезд, DailyMark. Schema и миграции первого среза не меняются. Реальная готовность — в [FEATURE_MATRIX](FEATURE_MATRIX.md), проверки — в [DEVELOPMENT_LOG](DEVELOPMENT_LOG.md).

## Этап 0 — зафиксировать базу
- Получить полный исходник и подтвердить актуальность `3.txt`.
- Создать воспроизводимый React + TypeScript build.
- Отделить fixtures/demo adapter от production API.
- Составить feature matrix и тестовую матрицу ролей.

## Этап 1 — декомпозиция frontend
- Разнести UI, доменные типы, store/query layer и интеграции.
- Сохранить текущие маршруты и сценарии.
- Добавить дизайн-токены и единый набор компонентов.
- Добавить unit tests на утилиты, permissions и критичные формы.

## Этап 2 — backend и данные
- Зафиксировать доменную модель и ADR по открытым вопросам.
- PostgreSQL + Prisma migrations.
- API contracts, schema validation, error format, pagination.
- Сервисный слой для смен, участников, программы, банка, опросов и техзапросов.

## Этап 3 — Telegram auth и RBAC
- Серверная проверка initData и auth_date.
- Сессии и привязка Telegram аккаунта.
- Серверный permission resolver по глобальной роли + должности в смене + scope ресурса.
- Негативные тесты IDOR и cross-shift access.

## Этап 4 — основные вертикальные срезы
- Shifts + visibility + applications.
- Squads + SquadMember + child records + payment/check-in/rooms.
- Program + BankEvent + BankEventFile.
- DailyMark.
- TechRequest.
- Survey + submissions/results/export.
- Documents + comments + onboarding/account approval.
- Notifications + bot delivery + audit log.

## Этап 5 — интеграции и эксплуатация
- Excel/CSV import preview/confirm.
- Google Sheets реальный интеграционный путь.
- Private object storage.
- Logging/monitoring/backups/rate limiting.
- CI, staging, smoke tests, deployment runbook.

## Критерии релиза
- Все P0 security checks пройдены.
- Миграции применяются с чистой БД.
- Нет mock API в production build.
- Главные потоки ADMIN/LEAD/TRAINEE покрыты e2e.
- Все критичные операции серверно авторизованы и журналируются.
- Восстановление из backup проверено.
