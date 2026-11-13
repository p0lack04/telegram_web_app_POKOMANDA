# Матрица функций — 2026-11-13

## Этап 3 — read-only Squad (APPROVED решения D1/D2/D3/D14/D12)

| Экран / действие | UI / источник | Persistence / API | Auth / scope | Тест | Статус |
|---|---|---|---|---|---|
| Список и карточка метаданных отряда | `frontend/src/Squads.tsx`, `ShiftDetail` | `GET /api/shifts/:id/squads`, `GET /api/shifts/:id/squads/:squadId`; Prisma schema без изменений | active + shift visibility; `squad.view_all` либо scoped `squad.view_own`; membership без permission не даёт доступ; скрытый detail 404 | backend integration, frontend, browser smoke | **готово этап 3, read-only** |
| Количество, состав детей/сотрудников, Squad CRUD, DailyMark | будущие модули | не реализовано | отдельные object/field policies pending | нет | **схема / не входит в срез** |

Статусы: **готово v1** = есть реальный UI → API → PostgreSQL, серверная auth/policy и тесты; **схема** = модель/решение заложены, use-case ещё не подключён; **прототип** = только `3.txt`, не production; **не начато**.

| Экран / действие | UI / источник | Persistence / API | Auth / scope | Тест | Статус |
|---|---|---|---|---|---|

| Вход Telegram Mini App | `frontend/src/App.tsx`, `telegram.ts` | raw initData → `POST /api/auth/telegram`; Session + TelegramReplay | HMAC, TTL 5 мин, timing-safe, replay digest, HttpOnly cookie | `telegram-auth.test`, integration replay | **готово v1** |
| Dev/browser fallback | гостевой экран | нет фиктивной identity | production не принимает ID/query; browser без Telegram остаётся гостем | browser smoke guest | **готово v1** |
| `/me`, logout, session | App/API client | `/auth/me`, `/auth/logout`, Session hash | cookie, текущий User загружается сервером | integration/HTTP client | **готово v1** |
| Онбординг | двухшаговая форма | `/auth/onboard`, User fields + AuditLog | роль не принимается из body; pending trainee block | schema + integration escalation | **готово v1** |
| Pending/rejected gate | status screen + refresh | `/auth/me`, accountStatus | до подтверждения доменные данные 403 | integration/browser | **готово v1** |
| ADMIN pending confirm/reject | Team screen | `/users/pending`, `/users/:id/{confirm,reject}` транзакционно | только ADMIN, нельзя self/admin decision, revoke reject sessions | integration + browser | **готово v1** |
| Список смен / visibility | Shifts screen | `GET /shifts` pagination | visibility server-side + active account | integration cross-role | **готово v1** |
| Деталь смены / direct ID | ShiftDetail | `GET /shifts/:id` | visibility перед resource load | integration hidden direct ID | **готово v1** |
| Создание смены | ADMIN form | `POST /shifts` + AuditLog | ADMIN only, Zod dates, origin | integration/browser | **готово v1** |
| Стадии смены | Staffing recruitment form | PATCH recruitment.stage + audit | ADMIN | integration/browser | **готово этап 2** |
| Applications / набор | `frontend/src/Staffing.tsx` | staffing endpoints, Application.version, unique admission | own/ADMIN scopes; flags control type; version-CAS decisions | 99 backend + 25 frontend + browser | **готово этап 2** |
| ShiftRole / должности | `frontend/src/Staffing.tsx` | roles/staff/candidates endpoints, ShiftRole unique, migration | shift.manage_roles; ADMIN-only Руководитель; same-shift squad membership | integration + browser | **готово этап 2** |
| Recruitment/stage controls | `Staffing.tsx` | PATCH recruitment, audit | ADMIN only, independent flags | integration + browser | **готово этап 2** |
| Staffing history | `Staffing.tsx` | AuditLog staffing actions, subject summary | own/manager/ADMIN filtered | integration + browser | **готово этап 2** |
| In-app staffing notifications | profile inbox | Notification.shiftId, visibility recheck, read endpoint | recipient-only + current shift visibility | regression + browser | **готово этап 2** |

| RBAC object/field checks | central domain policy + staffing service | admission/roles/notifications scope | active + visible + action/target | negative integration tests | **готово staffing, остальное не внедрено** |
| Squad CRUD / управление | `3.txt` only | Squad schema; mutations отсутствуют | management policy pending; read-only метаданные реализованы отдельно выше | не реализован | **схема** |
| Child/ped staff membership | `3.txt` only | SquadMember + DB identity CHECK | child без User, staff с User | migration CHECK integration | **схема** |
| Rooms/payment/checkin | `3.txt` only | SquadMember fields; PARTIAL note CHECK | field-level permissions planned | DB constraint integration | **схема** |
| DailyMark | `3.txt` only | unique member+date | setter scope planned | не реализован | **схема** |
| BankEvent catalog | `3.txt` only | BankEvent schema | public/private policy planned | не реализован | **схема** |
| BankEventFile upload/download | `3.txt` object/data URL | private metadata storage schema, scanStatus | protected signed/object storage endpoint pending | не реализован | **прототип + схема** |
| Program / bank link | `3.txt` fake API | ProgramItem owns bankEventId | change audit/schema | не реализован | **схема** |
| TechRequest | `3.txt` fake statuses | single owner TechRequest.programItemId + shift FK | tech lead/assignee policy pending | не реализован | **схема** |
| Surveys / submission | `3.txt` answer upsert | SurveySubmission unique user+survey | audience / one atomic submission planned | не реализован | **схема** |
| Documents | `3.txt` metadata only | UserDocument metadata | restricted DTO/policy pending | не реализован | **прототип + схема** |
| Trainee/selection comments | `3.txt` in-memory | comments FK/index | ADMIN/LEAD + shift scope pending | не реализован | **прототип + схема** |
| CSV/XLSX import | `3.txt` browser preview + CDN SheetJS | ImportJob preview/confirm schema | no FIO-only merge; backend parser pending | не реализован | **прототип + схема** |
| Google Sheets | `3.txt` generates rows by ID | no real integration | OAuth/export backend pending | не реализован | **прототип** |
| Telegram bot delivery | Outbox/Preference schema only | worker/webhook отсутствуют | никакой фиктивной доставки | нет | **не готово; in-app inbox готов отдельно** |
| Audit | Staffing history UI + foundation | AuditLog transaction with mutation | current shift/own scope, minimal subject DTO | integration/browser | **готово foundation + staffing** |
| Main UX / responsive | `frontend` | TanStack Query API | Telegram theme/safe-area/reduced-motion | browser 320/390 + dark | **готово v1** |
| Bank/surveys/program UI | `3.txt` only | no real endpoint | must not show as ready | n/a | **не начато production** |
| Свой профиль | App profile | `/auth/me` DTO | только собственные данные | integration DTO + browser nav | **готово v1** |
| Просмотр чужого профиля / team directory | `ScreenUserProfile`, `ScreenTeam` в 3.txt | User schema, API нет | privacy allowlists pending | нет | **прототип** |
| Повышение стажёра / понижение ведущего | `api.users.patchRole` в 3.txt | поле User.role | ADMIN-only endpoint отсутствует | нет | **прототип** |
| Стаж / число завершённых смен / должности | `api.users.stats` в 3.txt | manual fields сохранены, вычисления DISTINCT shiftId pending | фильтр видимости истории pending | нет | **частично: manual fields** |
| Ручное принятие участника на смену | CandidateSearch | POST staff creates APPROVED Application | ADMIN, confirmed target, no bypass rejected | integration/browser | **готово этап 2** |
| Открыть/закрыть набор отдельно | Recruitment | PATCH recruitment | ADMIN | integration/browser | **готово этап 2** |
| Изменить этап / настройки / видимость | Staffing stage ready; остальные patch-settings не подключены | stage PATCH ready; visibility только при создании | ADMIN | stage integration/browser | **частично: этап готов, редактирование visibility/title/dates не готово** |
| Мой отряд / поиск / фильтр типа | `ScreenMySquad`, `ScreenSquad` | membership schema, API нет | свой отряд, дети PII | нет | **прототип + схема** |
| Мои отметки стажёра | `ScreenDailyMarks`, profile marks | DailyMark schema | own-only endpoint pending | нет | **схема** |
| Программа: reorder/conflicts/ответственный | `ProgramBlock`, `ProgramItemModal` | ProgramItem + AuditLog | field rules / author changes pending | time CHECK DB only | **схема** |
| Предложения изменений программы | `api.program.propose/resolveProposal` | ProgramProposal schema | creator/admin decision pending | нет | **схема** |
| История программы | `ChangelogModal` | AuditLog (пока auth/shift only) | read scope pending | нет | **частично: schema** |
| Привязать/отвязать банк / addToProgram | `api.bankEvents.addToProgram`, `unlinkBank` | bankEventId restrict FK | права программы + приватность банка pending | нет | **схема** |
| Файлы: delete/gallery/progress | `GalleryModal`, `FileRow`, `UploadFilesModal` | schema, реального storage нет | scanner/private delivery pending | size CHECK DB only | **прототип** |
| Опрос: конструктор/activation/delete | `SurveyFormModal`, `SurveysBlock` | Survey/Question schema | create/results permissions pending | нет | **схема** |
| Опрос: результаты/CSV/диаграммы | `ScreenSurveyResults`, `api.surveys.exportCSV` | Answer/Submission schema | aggregate privacy + formula injection protection pending | FK/unique DB integration only | **схема** |
| Документы: summary/CRUD/expiry | `ScreenDocs`, `MyDocuments`, `docStatusOf` | metadata schema | LEAD18+/ADMIN + access audit pending | нет | **схема** |
| Knowledge: catalog/search/CRUD | `ScreenKnowledge`, `api.knowledge` | Knowledge schema | confirmed read/ADMIN write pending | нет | **схема** |
| Notifications inbox/read-all | OwnStaffing inbox | GET own notifications + POST single read | owner + current visibility | regression/browser | **inbox + single read готово; read-all не готово** |
| Settings: opt-in/per-user prefs | `SettingsInline` (в демо глобальные) | NotificationPreference per-user | own settings policy pending | нет | **схема** |
| Bot commands /start /help /profile /shifts /squad /surveys | `ScreenBot` симуляция | Outbox schema, webhook/worker нет | webhook secret / chat linkage pending | нет | **прототип** |
| Document reminders 30/14/7 / retry/idempotency | только текст и botLog демо | Outbox.dedupeKey/attempts schema | opt-in / confirmed recipient pending | нет | **схема** |
| WebSocket live updates | требование 1.txt | нет | filtered subscriptions pending | нет | **не начато** |

## Не перенесённые симуляции
- `3.txt`: in-memory `store`, fake JWT, `delay`, seed users, client-side `need`, object URL uploads, generated `parseGoogleSheet`, fake bot chat.
- Remote каркас `origin/main`: missing `bank.ts`/`users.ts`, empty routes, missing `KomandaApp`, undefined `app.authenticate`, BigInt DTO issue; не включён автоматически.

## Риски и следующие вертикальные срезы
Для первого среза проверены ключевые P0-контроли auth/session/visibility/onboarding; это не итоговый security sign-off. P1 remains: squads/members/daily marks → program/bank/files → surveys/tech → import/Google/bot. P2 remains: full navigation replacement for all demo screens, e2e each role/resource, deployment/backup/monitoring.

Честная граница: foundation и этап 2 (заявки, допуск, должности, история, in-app notifications) реализованы и проверены. Отряды/дети/оплата/комнаты/DailyMark, программа/банк, опросы/техзапросы, документы/комментарии, imports и Telegram delivery остаются следующими этапами. Withdrawal/пересмотр закрытых заявок не входят в согласованный этап 2.
