# ПО «Команда» — Telegram Mini App

**Статус: Foundation, этап 2 и backend/UI-срез этапа 3 (дети и XLSX) реализованы; полный этап 3 ещё не завершён.**

## Этап 3 — отряды, дети и участники

Внутри смены доступны список и карточка отрядов, состав детей, ручное создание, размещение и XLSX workflow upload → preview → explicit commit. Дети остаются `SquadMember` типа `CHILD` внутри конкретной смены; медицинские и родительские данные не собираются. DTO отряда сохраняет совместимость PR #5: только `id/name/color/sortOrder`. Права и scope проверяются сервером.

| Метод | Путь | Ответ / доступ |
|---|---|---|
| GET | `/api/shifts/:id/squads?page=1&pageSize=20` | `{items,total,page,pageSize}`; total — число разрешённых отрядов, не участников; pageSize ≤ 100 |
| GET | `/api/shifts/:id/squads/:squadId` | `{squad}`; тот же object scope |
| GET | `/api/shifts/:id/squads/:squadId/children?page=1&pageSize=20` | список детей разрешённого отряда |
| POST | `/api/shifts/:id/squads/:squadId/children` | ручное создание CHILD, `squad.manage` |
| PATCH | `/api/shifts/:id/squads/:squadId/children/:memberId` | размещение, `participants.edit_room` |
| POST | `/api/shifts/:id/children/import/preview` | XLSX preview, `participants.import` |
| POST | `/api/shifts/:id/children/import/:jobId/commit` | явное подтверждение и транзакционная запись |

Список видимой смены без view permissions — 403. Несуществующая/невидимая смена и недоступный/чужой detail — 404. Query строгий, клиентский userId не принимается. Новые Squad endpoints не меняют staffing metadata/assignment contracts. Решения: [ADR-005](docs/ARCHITECTURE.md), [права](docs/PERMISSIONS.md).

Исходные TXT исключены из отслеживаемого Git tree; локальные файлы в корне сохранены и используются для сверки требований. Демо не включено в production bundle. Сейчас работают Telegram auth/session, онбординг, смены, staffing, метаданные отрядов, дети и XLSX import. Squad CRUD, архивирование, capacity policy, DailyMark, программа, банк, опросы и внешние интеграции пока не являются готовыми модулями. Подробности: [матрица функций](docs/FEATURE_MATRIX.md).

## Стек
- React 18, TypeScript, Vite 8, TanStack Query.
- Fastify 5, Zod 4, opaque HttpOnly cookie sessions (не JWT в localStorage).
- PostgreSQL + Prisma 6.19, начальная миграция + SQL CHECK.
- Vitest 5, настоящий временный PostgreSQL в integration tests, Playwright Chromium browser smoke.

## Требования
Node.js **22.19+** (проверено на Node 26.13), npm 11, постоянный PostgreSQL для обычного запуска. Встроенный PostgreSQL — исключительно dev/test dependency; приложение само не поднимает production БД.

## Установка и проверки
Из корня:
```bash
npm ci --ignore-scripts
npm run generate
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```
`npm test` поднимает изолированный временный PostgreSQL на свободном loopback-порту, применяет миграции, создаёт синтетические fixtures и останавливает кластер. Никакая внешняя БД не очищается. На Linux запускайте от обычного пользователя, не root. Первой инициализации может потребоваться разрешение запуска бинарников PostgreSQL.

Проверка интерфейса:
```bash
npx playwright install chromium
npm run test:browser
```
На Linux для браузера могут потребоваться `npx playwright install --with-deps chromium` и системные библиотеки. Скрипт запускает настоящие API, Vite, PostgreSQL и браузер; проверяет ADMIN/LEAD/TRAINEE, подтверждение анкеты и гостевой экран, оставляет скриншоты в игнорируемом `test-results/`. Тестовые сессии вставляются только скриптом в тестовую БД; публичного dev-login в API нет.

## Локальный запуск
1. Создайте отдельную БД и пользователя PostgreSQL с подходящими правами. Используйте отдельные dev credentials.
2. Скопируйте `backend/.env.example` в `backend/.env`. Укажите реальный `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `APP_ORIGIN`.
3. Примените миграцию с переменной окружения (Prisma читает `backend/.env`):
```bash
npm run db:validate
npm run db:deploy
```
4. В разных терминалах:
```bash
npm run dev:api
npm run dev:web
```
API по умолчанию слушает `127.0.0.1:3001`, frontend — `http://localhost:5173`. Vite проксирует `/api`; не используйте произвольный другой hostname вместо заданного `APP_ORIGIN`.

В обычном браузере без действующей cookie отображается гостевой экран, а не фиктивный вход. Для настоящей авторизации откройте Mini App из Telegram через HTTPS домен/туннель и настройте этот адрес в BotFather и `APP_ORIGIN`. Сервисов туннелирования/бота в этой задаче не настраивалось.

### Первый dev-руководитель
Только для собственной development/test БД:
```bash
# Задайте DATABASE_URL в shell или через --env-file; seed сам .env не подгружает.
NODE_ENV=development ADMIN_TELEGRAM_ID=<ваш_числовой_Telegram_ID> npm run db:seed -w backend
```
На Windows эти env можно задать в Git Bash или через `node --env-file=backend/.env --import tsx backend/prisma/seed.ts`, добавив `ADMIN_TELEGRAM_ID` в локальный `.env`. Seed откажется работать в production. Роль dev-руководителя задаётся серверно; онбординг всё равно нужен. Production bootstrap администратора пока требует отдельной согласованной операционной процедуры — не используйте dev seed на production БД.

## Реализованные API
Ответы ошибок: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.
Все изменяющие запросы требуют точный `Origin: APP_ORIGIN` и JSON. Cookie отправляется `credentials: include`.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/health` | liveness, без данных БД |
| POST | `/api/auth/telegram` | `{initData}` → `{user}` и cookie |
| GET | `/api/auth/me` | собственный DTO |
| GET | `/api/auth/onboard/status` | onboarding/status |
| POST | `/api/auth/onboard` | проверенная анкета |
| POST | `/api/auth/logout` | отзыв текущей сессии |
| GET | `/api/users/pending?page=1&pageSize=20` | ADMIN, только отправленные анкеты |
| POST | `/api/users/:id/confirm` | ADMIN, транзакционное подтверждение |
| POST | `/api/users/:id/reject` | ADMIN, отклонение и отзыв сессий |
| GET | `/api/shifts?page=1&pageSize=20` | active account, visibility filter |
| GET | `/api/shifts?upcoming=true` | ближайшие, сортировка до пагинации |
| GET | `/api/shifts/:id` | 404 на невидимую смену |
| POST | `/api/shifts` | ADMIN, создание + audit |

## Этап 2 — API и миграции

Все списки поддерживают `page/pageSize` (максимум 100). DTO персонала: ID/ФИО/глобальная роль, без контактов/даты рождения/Telegram ID.

| Метод | Путь | Доступ/назначение |
|---|---|---|
| GET | `/api/shifts/:id/staffing` | active + visible; server flags/catalog |
| GET / POST | `/api/shifts/:id/applications` | ADMIN все / остальные свои; POST собственная заявка `{type}` |
| PATCH | `/api/applications/:id` | ADMIN `{status: APPROVED/REJECTED, version}` |
| GET | `/api/me/applications` | свои заявки с current visibility |
| PATCH | `/api/shifts/:id/recruitment` | ADMIN flags/stage |
| GET | `/api/shifts/:id/staff-candidates?search=...` | ADMIN, минимум 2 символа |
| GET / POST | `/api/shifts/:id/staff` | менеджер читает; ADMIN добавляет `{userId}` |
| GET / POST | `/api/shifts/:id/roles` | own/manager read; manager assign `{userId,position,squadId?}` |
| DELETE | `/api/shifts/:id/roles/:roleId` | manager, руководителя только ADMIN |
| GET | `/api/me/assignments` | собственные назначения |
| GET | `/api/shifts/:id/staffing-history` | own / manager positions / ADMIN full |
| GET | `/api/me/notifications` | свой inbox + актуальная visibility |
| POST | `/api/me/notifications/:id/read` | только владелец, видимая смена |

`202611110002_staffing`: Application.version default 0 + nonnegative CHECK, индексы заявок/ролей/истории. `202611110003_notification_scope`: nullable Notification.shiftId + FK/index. Обе миграции аддитивны, существующие строки не удаляются. Upgrade с данными foundation проверен integration test. Старые STAFFING-уведомления без shiftId сохраняются в БД, но скрыты API: надёжно восстановить связь из текста нельзя. После backup применяйте `npm run db:deploy`; не редактируйте уже применённую migration и не используйте reset.

Заявку рассматривает ADMIN, участие и должность — разные сущности; повторное решение/подача закрытой заявки не реализуются. In-app notification не означает Telegram delivery. Реальный browser smoke проверяет apply/approve/reject/manual add/assign/remove/history/inbox/deputy controls на PostgreSQL; 124 unit/integration/frontend tests проходят.

## Безопасность и эксплуатационные границы
- HMAC Telegram, TTL 5 минут, нечисловые/будущие даты/дубли ключей/неверная identity запрещены. Replay связывается с подписью, не с порядком параметров URL.
- Cookie HttpOnly, SameSite=Strict, Secure + `__Host-` в production; TTL 12 часов. Роли/статусы перечитываются на каждом запросе. Session token в БД только SHA256.
- Pending/rejected не имеют доступа к доменным API. Клиент не задаёт глобальную роль.
- Same-origin deployment обязателен: HTTPS reverse proxy раздаёт `frontend/dist` и проксирует `/api`. Cross-origin CORS не включён. Реальное поведение cookie в Telegram Web/iOS/Android ещё требует проверки, особенно в third-party iframe.
- API не пишет request headers/body/URL, initData, token и PII в лог. Structured operational error monitoring пока не настроен.
- Полная схема не является доказательством готовности функций. Проверки аудитории опросов, object/field-level права будущих модулей и файловые интеграции ещё предстоит реализовать.
- Нужны maintenance jobs очистки expired Session/TelegramReplay и согласованная retention policy для PII/audit/import preview.
- Утилита override исправляет уязвимые зависимости Prisma CLI; `npm audit` и validate/generate/migrate проверены с lockfile.
- Начальная миграция предназначена для **новой пустой БД**. Миграция существующих данных, rollback, backups/restore ещё не проверены. Не запускайте reset/db push на чужой БД.
- Production frontend требует CSP на reverse proxy: минимум self + официальный Telegram script, без произвольных remote import. Заголовки для frontend и развёртывание пока не подготовлены.

## Что нужно предоставить для следующих этапов
1. HTTPS домен Mini App и Telegram bot token (только в server env, не в чате/репозитории).
2. Постоянную PostgreSQL и политику backups/retention; безопасный bootstrap ADMIN.
3. Приватное S3-compatible хранилище или серверный volume, scan service для файлов.
4. Способ доступа к Google Sheets: OAuth/service account/разрешённый экспорт; никакие данные не имитируются.
5. Политики согласия несовершеннолетних, уведомлений и обработки персональных данных.

## Аудит и решения
- [Baseline](docs/audit/BASELINE.md)
- [Матрица функций](docs/FEATURE_MATRIX.md)
- [ADR и этапы](docs/ARCHITECTURE.md)
- [Отчёт этапа 1](docs/PHASE-1-REPORT.md)


## Работа с ChatGPT и Codex

Локальные инструкции, навыки, настройки агентов и граф исключены из Git. Для разработки начните с [контекста](docs/PROJECT_CONTEXT.md), [матрицы функций](docs/FEATURE_MATRIX.md), [аудита](docs/audit/INITIAL-REPOSITORY-REVIEW.md) и [этапов](docs/IMPLEMENTATION-ROADMAP.md).

Аудит 2026-11-15: этап 3 частичен; дети и XLSX имеют backend/UI, но требуют исправлений и отдельной browser-приёмки. Актуальные результаты проверок — в документах выше.

### Staffing API: explicit squad detach

Managers with `shift.manage_roles` can detach a role without deleting it using `PATCH /api/shifts/:id/roles/:roleId/squad` and body `{ "squadId": null }`. The operation preserves the position and its permissions. Moving or removing the last squad membership is rejected with HTTP 409 until the role is detached.

## Приватные файлы банка (рабочая реализация этапа 4)

API: `GET/POST /api/bank-events/:eventId/files`, `POST .../:fileId/scan`, `GET .../:fileId/download`, `DELETE .../:fileId`. Upload — multipart с одним полем `file` и UUID-заголовком `Idempotency-Key`; повтор загрузки тех же байтов с тем же ключом не создаёт вторую запись. Ошибка S3 возвращает 503, ошибка сканирования оставляет ERROR, доступ к скачиванию разрешён только CLEAN. Прогресс передачи 100% не означает окончание проверки. Сканы личных документов не добавляются.

Документы: PDF/DOCX/XLSX/PPTX/TXT ≤20 МиБ; медиа JPG/PNG/GIF/MP4/MP3/WAV ≤50 МиБ. Проверяются имя, расширение, MIME, сигнатура содержимого (TXT — UTF-8), SHA-256 и ClamAV. Ключ объекта случайный, пользовательское имя не используется как путь. Объекты должны находиться в приватном bucket; API выдаёт байты после повторной авторизации, с attachment/no-store/nosniff. Превью ограничено проверенными изображениями/аудио/видео, SVG/HTML не поддерживаются.

Настройка только backend env: S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, CLAMAV_HOST, CLAMAV_PORT. Все основные параметры задаются вместе; без них API загрузки недоступен. Production S3 endpoint требует HTTPS. Bucket должен иметь запрет анонимного чтения; production конфигурация и реальные файлы этим заданием не затрагиваются.

Изолированная тестовая среда (Docker требуется, в текущей среде отсутствует):

```powershell
docker compose -f compose.files-test.yml up -d
# Дождитесь готовности ClamAV и создания private bucket; проверьте docker compose logs.
$env:RUN_FILES_SERVICES='1'
npm.cmd test -w backend -- --run test/bank-files.integration.test.ts
Remove-Item Env:RUN_FILES_SERVICES
```

Opt-in тест использует только loopback MinIO `komanda-test` из compose, синтетические credentials и файлы; проверяет anonymous 403, CLEAN, безопасную EICAR-сигнатуру, запрет скачивания INFECTED, 50 МиБ INSTREAM, удаление и orphan cleanup. Без флага тест явно SKIP. Обычный HTTP/PostgreSQL suite и browser используют тестовые adapters и НЕ доказывают работу реального S3/ClamAV. Настройки CLAMD_CONF_* поддерживаются [официальным entrypoint ClamAV 1.4](https://github.com/Cisco-Talos/clamav-docker/blob/main/clamav/1.4/alpine/scripts/docker-entrypoint.sh); реальный запуск конфигурации ещё требует приёмки.

После явного удаления запись помечается deletedAt и немедленно исчезает из выдачи; неуспех внешнего удаления оставляет cleanupPending. Операционная очистка повторяет удаление tombstones и удаляет объекты префикса bank/ без metadata:

```powershell
npm.cmd run build
node --env-file=backend/.env backend/dist/cleanup-bank-files.js
```

Запускайте maintenance только с конфигурацией нужного изолированного окружения; для production требуется отдельный операционный запуск владельцем. TTL материалов не вводится. Незавершённые PENDING/ERROR можно повторно проверить через UI, при сбое PUT — повторить исходную загрузку с тем же ключом. Автоматическая очередь фоновых проверок не заявляется реализованной.
