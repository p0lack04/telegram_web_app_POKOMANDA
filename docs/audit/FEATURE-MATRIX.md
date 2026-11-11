# Матрица функций — 2026-11-11

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
| Стадии смены | UI scope note; ShiftStage schema | API mutation не подключена | policy предусмотрена | domain visibility only | **схема** |
| Applications / набор | `3.txt` only | Application schema unique | будущий scope shift + role/status | не реализован | **прототип** |
| ShiftRole / должности | `domain/permissions.ts`, Prisma | schema unique, resolver | global role отдельно, position per shift | 47 unit permissions | **схема** |
| RBAC object/field checks | central domain policy | services policy foundation | active account + visible shift | domain tests | **частично: foundation** |
| Squad CRUD / visibility | `3.txt` only | Squad/SquadMember schema composite shift FK | будущий view_all/view_own | не реализован | **схема** |
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
| Telegram bot / notifications | `3.txt` botLog simulator | Outbox/Preference schema | token/queue/webhook pending | не реализован | **прототип + схема** |
| Audit | `3.txt` local changeLog | AuditLog used for auth/onboard/shift | no PII in details by policy | integration count | **частично: foundation** |
| Main UX / responsive | `frontend` | TanStack Query API | Telegram theme/safe-area/reduced-motion | browser 320/390 + dark | **готово v1** |
| Bank/surveys/program UI | `3.txt` only | no real endpoint | must not show as ready | n/a | **не начато production** |
| Свой профиль | App profile | `/auth/me` DTO | только собственные данные | integration DTO + browser nav | **готово v1** |
| Просмотр чужого профиля / team directory | `ScreenUserProfile`, `ScreenTeam` в 3.txt | User schema, API нет | privacy allowlists pending | нет | **прототип** |
| Повышение стажёра / понижение ведущего | `api.users.patchRole` в 3.txt | поле User.role | ADMIN-only endpoint отсутствует | нет | **прототип** |
| Стаж / число завершённых смен / должности | `api.users.stats` в 3.txt | manual fields сохранены, вычисления DISTINCT shiftId pending | фильтр видимости истории pending | нет | **частично: manual fields** |
| Ручное принятие участника на смену | `api.applications.addManually` | Application schema | ADMIN / confirmed target planned | нет | **схема** |
| Открыть/закрыть набор отдельно | `api.shifts.toggleRecruit` | Shift recruit flags | ADMIN policy, уведомления pending | нет | **схема** |
| Изменить этап / настройки / видимость | `ShiftSettingsModal`, `setStage` | Shift fields | patch endpoints отсутствуют | нет | **прототип + схема** |
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
| Notifications inbox/read-all | `ScreenNotifications`, `notify` | Notification schema | own inbox scope pending | нет | **схема** |
| Settings: opt-in/per-user prefs | `SettingsInline` (в демо глобальные) | NotificationPreference per-user | own settings policy pending | нет | **схема** |
| Bot commands /start /help /profile /shifts /squad /surveys | `ScreenBot` симуляция | Outbox schema, webhook/worker нет | webhook secret / chat linkage pending | нет | **прототип** |
| Document reminders 30/14/7 / retry/idempotency | только текст и botLog демо | Outbox.dedupeKey/attempts schema | opt-in / confirmed recipient pending | нет | **схема** |
| WebSocket live updates | требование 1.txt | нет | filtered subscriptions pending | нет | **не начато** |

## Не перенесённые симуляции
- `3.txt`: in-memory `store`, fake JWT, `delay`, seed users, client-side `need`, object URL uploads, generated `parseGoogleSheet`, fake bot chat.
- Remote каркас `origin/main`: missing `bank.ts`/`users.ts`, empty routes, missing `KomandaApp`, undefined `app.authenticate`, BigInt DTO issue; не включён автоматически.

## Риски и следующие вертикальные срезы
Для первого среза проверены ключевые P0-контроли auth/session/visibility/onboarding; это не итоговый security sign-off. P1 remains: applications/roles → squads/members/daily marks → program/bank/files → surveys/tech → import/Google/bot. P2 remains: full navigation replacement for all demo screens, e2e each role/resource, deployment/backup/monitoring.

Честная граница: реализованы и проверены сейчас только вход, onboarding/approval, shifts и foundation schema/policies; это не production-релиз всего приложения. Остальные кнопки намеренно не отображаются как готовые.
