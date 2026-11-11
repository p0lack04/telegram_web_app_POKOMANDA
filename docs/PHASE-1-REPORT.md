# Этап 1 — аудит и первый реальный срез

Дата: 2026-11-11. Ветка `feat/production-foundation`. Коммитов/push/deployment не выполнялось.

## Что прочитано и сохранено
Полностью прочитаны CLAUDE.md, 1.txt, 2.txt, 3.txt, все 9 project skills, все 5 project agents и существующие audit/roadmap docs. Исходные TXT не редактировались. Локальный origin/main также проверен чтением: 24 файла, часть пустые/неполные. Рабочий main был unborn, поэтому `git diff` не показывает новые файлы — они untracked, не staged. Не выполнялись checkout/reset/merge удалённого каркаса.

## Аудит и план
Добавлены `docs/audit/BASELINE.md`, `FEATURE-MATRIX.md`, `docs/architecture/DECISIONS.md`. Старые документы сохранены как исходные. Дополнительные требования 2.txt приняты как уточнения; опасные неоднозначности решены консервативно с явными допущениями (не самоназначать LEAD, не сливать ФИО, PARTIAL note, одно DailyMark/member/date, несколько отрядов разрешены).

Параллельные агенты: remote audit завершился отчётом; matrix/frontend прервались HTTP 429 и не реализовали функции. Schema agent не смог записать файл из-за ограничения инструмента на пути worktree; файлов не изменил. Итоговый код создан и проверен в основном рабочем дереве, не зачислялся по обещаниям агентов.

## Изменения — было → стало
- **Было:** JSX в `3.txt`, in-memory API. **Стало:** npm workspaces backend/frontend, единый lockfile, TypeScript/ESLint/test/build scripts. Демо по-прежнему сохранено, не выдано за production.
- **Было:** выбор seed user ID и fake JWT. **Стало:** server Telegram HMAC/TTL/duplicate-key/identity validation, canonical replay digest, random opaque HttpOnly cookie session; SHA256 в PostgreSQL, 12h expiry, live role/status checks.
- **Было:** onboarding/confirmation в браузерной памяти. **Стало:** реальные `/auth/onboard`, `/users/pending`, confirm/reject, транзакционные обновления/audit; pending/rejected не читают домен.
- **Было:** локальные смены. **Стало:** real create/list/detail UI/API/DB, pagination, visibility на сервере, 404 для невидимой детали, date validation и audit create.
- **Было:** отсутствующий запускаемый UI/entrypoint remote. **Стало:** React mobile-first shell, формы, loading/error/empty/success, серверные ошибки и безопасный browser fallback без dev-login.
- **Было:** нет схемы в рабочем дереве. **Стало:** широкая Prisma domain schema, начальная миграция, composite shift FKs, unique submissions/answers/marks, DB CHECK, dev-only bootstrap seed. Модель НЕ равна готовому модулю.
- **Было:** нет тестов. **Стало:** unit/HTTP/PostgreSQL integration и реальный браузерный smoke на синтетических данных.

## Основные новые файлы
- Root: `package.json`, `package-lock.json`, `.gitignore`, `eslint.config.mjs`, `README.md`.
- Backend: `package.json`, `tsconfig.json`, `.env.example`, `src/{index,app,config,errors}.ts`, `src/lib/telegram-auth.ts`, `src/domain/{schemas,permissions}.ts`, `src/services/{auth,dto}.ts`, `src/routes/index.ts`.
- Database: `backend/prisma/schema.prisma`, `seed.ts`, `migrations/migration_lock.toml`, `migrations/202611110001_foundation/migration.sql`.
- Tests: `backend/test/{telegram-auth,domain,integration}.test.ts`.
- Frontend: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/{main,App}.tsx`, `src/{types,api,telegram}.ts`, `styles.css`, `{api,telegram}.test.ts`.
- Browser: `scripts/browser-smoke.mjs`, игнорируемые screenshots в `test-results/`.
- Docs: baseline/matrix/ADR/этот отчёт.

## Фактически запущенные проверки
| Команда | Результат |
|---|---|
| baseline lint/typecheck/test/build | ENOENT — исходно нет package.json |
| `npm install --ignore-scripts` | зависимости установлены, lockfile создан |
| первый `prisma validate` | P1012 composite 1:1 unique; исправлено |
| первый typecheck | отсутствовал generated client / unknown Fastify error; исправлено |
| первый integration test | неверное чтение pg client.password в harness; исправлено |
| первый frontend typecheck | widening union tab key; исправлено |
| `npm run generate` | Prisma Client 6.19 сгенерирован |
| `DATABASE_URL=postgresql://test:test@localhost:5432/komanda npm run db:validate` | valid schema; команда проверяет схему, не подключается к этой БД |
| `prisma migrate diff --from-empty ... --script --output ...` | initial SQL создан; CHECK добавлены до первого применения |
| `npm run lint` (финал) | PASS |
| `npm run typecheck` (финал) | backend + frontend PASS |
| `npm test` (финал) | 66 backend + 6 frontend = **72 PASS**, без skipped |
| `npm run build` | backend + frontend PASS |
| `npm run test:browser` | build + actual API/Vite/PostgreSQL/Chromium PASS |
| `npm audit` | **0 vulnerabilities** на момент проверки |

Frontend production bundle: около 198.3 KB JS / 62.3 KB gzip, CSS около 8.7 KB / 2.55 KB gzip.

Browser smoke: ADMIN create + DB persistence; TRAINEE список/деталь без create; LEAD home + системная dark theme; pending → ADMIN confirm → status refresh; guest 320px; отсутствие горизонтального overflow и page errors. Скриншоты просмотрены. При просмотре обнаружена и исправлена ошибка light override из Telegram script в обычном браузере; regression test добавлен. После исправления повторный smoke прошёл без прежних BackButton warnings.

## Что НЕ проверено и НЕ готово
- Настоящий Telegram bot token/initData пользователя, iOS/Android/Web Telegram host и cookie behavior внутри Telegram iframe. Crypto/HTTP тесты используют подписанные синтетические test vectors; это не live Telegram login.
- В production нет deployment/HTTPS/reverse proxy/CSP/frontend hosting, нет постоянной подключённой БД и управляемого production bootstrap ADMIN.
- Нет готовых user-facing endpoints/UI для заявок, должностей, отрядов/детей/комнат/оплаты/заезда, DailyMark, банка/файлов, программы, техзапросов, опросов, документов/комментариев, knowledge, импорта, Google и бота. Всё это подробно отделено от готового в feature matrix.
- Полная object/field-level матрица RBAC для будущих модулей ещё не внедрена; central permission resolver сам по себе не решает scope. Должность с squadId должна дополнительно проверяться на членство транзакционно будущим application service.
- Нет реализованной очереди доставки, файлового scanner/storage, consent/retention/cleanup jobs, distributed rate limit, structured error monitoring/alerts.
- Migration проверена только на чистой временной БД. Data migration из старых систем/rollback/backups/restore не выполнялись.
- CI workflow пока не добавлен/не запускался. Browser smoke не заменяет полноценный e2e всех заявленных функций.

## Следующий этап
Вертикальный срез заявок и должностей, затем отрядов/участников/полевых прав/DailyMark с транзакциями и негативными тестами. После этого программа/банк/private files, surveys/tech и integrations. Текущий результат — рабочий фундамент с реальными данными, **не законченный продукт по всем требованиям**.

Для повторяемого запуска с временной БД/браузером полезно в будущем оформить проверенную процедуру через `/run-skill-generator`; сейчас есть воспроизводимый `npm run test:browser`.
