# ПО «Команда» — Telegram Mini App

**Статус: первая рабочая версия.**

Исходные TXT удалены предыдущими коммитами; требования отражены в постоянной документации. Демо не включено в production bundle. Сейчас реально работают Telegram auth/session, онбординг, подтверждение анкет, просмотр/создание смен с серверной видимостью, собственный профиль. Отряды, заявки, программа, банк, опросы и интеграции пока имеют модель данных/план, но не готовые API/экраны. Подробности: [матрица функций](docs/FEATURE_MATRIX.md).

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

