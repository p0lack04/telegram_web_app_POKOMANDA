# Матрица функций — аудит 2026-11-15

Источники 1.txt, 2.txt и 3.txt прочитаны полностью. Статусы сверены с кодом; ограничения приёмки — в [аудите](audit/INITIAL-REPOSITORY-REVIEW.md).

## Этап 3 — Squad, дети и XLSX (D15–D21)

| Экран / действие | UI / источник | Persistence / API | Auth / scope | Тест | Статус |
|---|---|---|---|---|---|
| Список и карточка метаданных отряда | `frontend/src/Squads.tsx`, `ShiftDetail` | `GET /api/shifts/:id/squads`, `GET /api/shifts/:id/squads/:squadId`; Prisma schema без изменений | active + shift visibility; `squad.view_all` либо scoped `squad.view_own`; membership без permission не даёт доступ; скрытый detail 404 | backend integration, frontend, browser smoke | **готово этап 3, read-only** |
| Количество, состав сотрудников, Squad CRUD, DailyMark | будущие модули | не реализовано | отдельные object/field policies pending | нет | **схема / не входит в срез** |
| Состав детей отряда | `frontend/src/Squads.tsx` | `GET /shifts/:id/squads/:squadId/children` | view scope отряда, capabilities | backend integration + browser | **срез 3А реализован** |
| Создание CHILD | `Squads.tsx` | `POST .../children` | `squad.manage` в доступном отряде | integration + browser без отчества | **срез 3А реализован** |
| Размещение и перевод CHILD | `Squads.tsx` | `PATCH .../children/:memberId` | `participants.edit_room`, same shift | integration/no-op + browser | **срез 3А реализован** |
| XLSX preview/mapping/commit | `ChildrenImport.tsx` | `/children/import/*`, `ImportJob` | import + edit_room для обновлений; TTL | integration + parser security + frontend/browser | **срез 3А реализован** |

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
| Членство педсостава | только демо | SquadMember schema; API отсутствует | staff с User, отдельно от допуска и должности | DB constraint tests | **схема; дети реализованы выше** |
| Оплата / заезд | только демо | SquadMember fields; PARTIAL note CHECK | отдельные полевые права | DB constraints | **схема; комнаты CHILD реализованы выше** |
| DailyMark | `3.txt` only | unique member+date | setter scope planned | не реализован | **схема** |
| BankEvent catalog | `3.txt` only | BankEvent schema | public/private policy planned | не реализован | **схема** |
| BankEventFile upload/download | `3.txt` object/data URL | private metadata storage schema, scanStatus | protected signed/object storage endpoint pending | не реализован | **прототип + схема** |
| Program / bank link | `Program.tsx` | ProgramWorkflowService + ProgramItem.bankEventId | field rights + bank scope + audit | HTTP + browser | **реализовано v1** |
| TechRequest | `3.txt` fake statuses | single owner TechRequest.programItemId + shift FK | tech lead/assignee policy pending | не реализован | **схема** |
| Surveys / submission | `3.txt` answer upsert | SurveySubmission unique user+survey | audience / one atomic submission planned | не реализован | **схема** |
| Documents | `3.txt` metadata only | UserDocument metadata | restricted DTO/policy pending | не реализован | **прототип + схема** |
| Trainee/selection comments | `3.txt` in-memory | comments FK/index | ADMIN/LEAD + shift scope pending | не реализован | **прототип + схема** |
| CSV / смешанный импорт | только демо | production поддерживает отдельный XLSX CHILD | не объединять по ФИО | нет | **не реализовано; XLSX CHILD отдельно выше** |
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
| Мой отряд / поиск / фильтр типа | scoped список и карточка; отдельного экрана/фильтров нет | scoped GET отрядов/детей есть | view_own + связь | scope integration/browser метаданных | **частично** |
| Мои отметки стажёра | `ScreenDailyMarks`, profile marks | DailyMark schema | own-only endpoint pending | нет | **схема** |
| Программа: CRUD/reorder/conflicts/ответственный | `Program.tsx` | ProgramWorkflowService + AuditLog | scope, field policies, lock, updatedAt CAS | HTTP/PostgreSQL + browser | **реализовано v1** |
| Предложения изменений программы | `Program.tsx` | ProgramProposal + AuditLog | LEAD с допуском/ADMIN; решение ADMIN; own/admin list | HTTP concurrency + browser | **реализовано v1, без уведомлений** |
| История программы | `Program.tsx` | AuditLog: действия, автор, дата; пагинация | текущий scope программы | HTTP + browser | **история действий v1; без снимков значений** |
| Привязать/отвязать банк / addToProgram | `Program.tsx` | ProgramWorkflowService + bankEventId FK | повторная проверка банка; скрытие закрытого оригинала | HTTP privacy + browser CRUD/original | **реализовано v1, файлы отдельно** |
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
- Упоминания сломанного remote-каркаса относятся к историческому состоянию 2026-11-11. Текущий origin/main содержит рабочий workspace.

## Риски и следующие вертикальные срезы
Foundation и этап 2 работают. Срез 3А исправляет детский UI/XLSX и добавляет полный пользовательский цикл поверх API/PostgreSQL. Этап 3 частичен: Squad CRUD, членство педсостава, оплата, заезд и DailyMark отсутствуют. Программа, банк, опросы, техзапросы, документы, комментарии, Google и Telegram delivery остаются будущими модулями.

Проверки среза 3А: 127 backend + 40 frontend tests PASS. Browser smoke расширен детьми/XLSX; окончательные результаты lint/typecheck/build/browser и ограничения — в [журнале](DEVELOPMENT_LOG.md).

Доказательства дефектов — [аудит](audit/INITIAL-REPOSITORY-REVIEW.md). Предложенный порядок и приёмка — [план](IMPLEMENTATION-ROADMAP.md). Пересмотр закрытых заявок требует отдельного решения.

## ������ ������ 3�/3� (2026-11-15)

- **3� ������ v1:** Squad CRUD, ������/����������/�������/������ ����������, �������� APPROVED �������, object/scope policies � audit.
- **3� ������ v1:** ��������� payment/check-in mutations, PARTIAL note invariant, DailyMark list/upsert � ������������� member+date, field-level permissions � audit; UI ���������� ���������� � ������ ������/�����.
- PostgreSQL schema ������������ ��� ��������� �������; ��������� additive migration `202611150004_stage_3bc`.


## Этап 4 — срез 2026-11-15
Базовый BankEvent catalog/search/create/update существует. Программа: CRUD, выбор активного принятого ответственного, фильтрация по дням, reorder, конфликты, блокировки, полевые права, updatedAt CAS, предложения и история действий подключены через UI/API/PostgreSQL. Файлы S3/ClamAV, файловый UI и уведомления программы не реализованы; этап 4 частичный.


## Актуальная проверка 2026-11-15

Backend-срезы Squad CRUD, членства, оплаты, заезда и DailyMark обнаружены в исходниках, но не имеют полного UI и regression-покрытия, поэтому 3Б/3В остаются частичными. Программа и банк реализованы; приватные файлы S3/ClamAV и файловый UI отсутствуют, этап 4 не закрыт.

| Явная отвязка ShiftRole от отряда | `Staffing.tsx` | `PATCH /api/shifts/:id/roles/:roleId/squad` | `shift.manage_roles`, ADMIN-only для «Руководитель», visibility/object scope; 409 защищает move/remove | integration + typecheck | **реализовано Stage 3Б** |

## Stage 3Б follow-up — review явной отвязки (2026-11-15)

- UI отвязки «Руководитель» доступен только ADMIN с серверным canManageRoles; остальные назначения требуют canManageRoles и непустой squadId.
- После staffing mutations, включая отвязку и ошибки, инвалидируются также списки/детали/placement отрядов и children capabilities. Session не инвалидируется: глобальная роль не меняется; права и scope перечитываются сервером.
- Frontend: матрица прав и инвалидация QueryClient; browser: подтверждение/отмена, pending, 403/409/500/network error, успешная отвязка и обновление списка/истории без reload.
- PostgreSQL: ADMIN-only, повторный no-op без второго audit/notification, несколько должностей/членств, сохранение admission/global role/permissions, актуальный scope в той же сессии, изоляция смен, конкурентные detach/move и rollback всей транзакции при ошибке notification.
- Browser flow назначает привязанную должность через UI, получает реальный 409 при переводе, отвязывает через UI и успешно переводит через API той же сессии. Формы перевода педсостава в текущем UI нет; весь Stage 3Б этим follow-up не закрывается. Stage 3В/4 не изменялись.
- Подробные результаты команд — в DEVELOPMENT_LOG.md. Модели, миграции и утверждённые бизнес-правила не изменены.