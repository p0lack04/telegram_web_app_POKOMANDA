# Журнал разработки

## Этап 3 — дети и XLSX

- Реализованы `ChildrenService`, ручное создание CHILD, список/detail и PATCH размещения с object scope и аудитом.
- Реализован XLSX parse → preview → mapping → explicit commit: TTL, partial import, ambiguity, no-op, snapshot и очистка preview PII.
- Parser hardening проверяет local/central directory, data descriptors, CRC, offsets/ranges, decompression и aggregate limits. Добавлены security regression tests.
- UI подключает состав отряда, создание, размещение и импорт с loading/error/empty/success состояниями.
- Миграция не нужна: использованы существующие `SquadMember` и `ImportJob`; архивирование/удаление/вместимость и staffing membership lifecycle не утверждены.

## 2026-11-13 — этап 3: read-only Squad metadata
- На feature branch `feat/squads-read-only` реализован первый вертикальный срез: список и detail метаданных отрядов в контексте смены. DTO allowlist: `id/name/color/sortOrder`; Prisma schema и migrations не менялись.
- D1/D2/D3/D14/D12 APPROVED: active + shift visibility; `view_all` для всех отрядов смены; иначе `view_own` по серверной связи через `ShiftRole.squadId` или `SquadMember.userId`; membership без permission не даёт доступ; несколько членств допустимы; list без view permissions — 403, hidden/foreign detail — 404.
- Добавлены backend policy/service/routes и PostgreSQL integration tests на union scope, pagination/count, cross-shift/hidden/IDOR, inactive/unauth, strict query и DTO. Frontend добавил список/detail внутри ShiftDetail, loading/empty/error/403/404/retry, keyboard/back navigation, mobile/dark/reduced-motion-compatible UI. Staffing не расширялся.
- Проверки после интеграции: 107 backend + 33 frontend tests PASS; lint, typecheck, build PASS; browser smoke с реальным API/PostgreSQL PASS (staffing regression + Squad list/detail, union scope, direct 404, denied access, empty, revoked-access cache/retry, keyboard/back, mobile/dark, no overflow/page errors/React warnings).

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

## 2026-11-15 — подготовка ChatGPT / Codex

Перенесены 10 навыков, бизнес-правила и три профиля субагентов; настроен Graphify MCP, добавлен CI. Lint/typecheck/build и все 156 тестов прошли. Инструкции настройки сохранены локально и исключены из Git. Код приложения и схема БД не менялись.

## 2026-11-15 — переход в komanda-codex

По решению владельца komanda-codex стала основной рабочей папкой. Перенесены настройки и незакоммиченные изменения, сохранены Git history и origin. Зависимости восстановлены по lockfile, Prisma Client создан заново. Предыдущая папка komanda сохранена.

## 2026-11-15 — очистка инструментов и полный аудит
По запросу владельца удалена прежняя интеграция Claude Code: каталог, инструкции, валидатор и отдельный отчёт конфигурации. Незакоммиченные исходники четырёх вложенных рабочих копий сохранены в игнорируемом локальном резервном каталоге; копии сверены SHA256. Настройки/навыки Codex, AGENTS.md, служебные инструкции, граф и резервные копии исключены из Git. CI сохранён как часть проекта. История Git не переписывалась; commit/push не выполнялись. Пользователь подтвердил продолжение на исходной dirty ветке chore/codex-setup.

Полностью изучены неизменённые 1.txt/2.txt/3.txt; существующий Graphify использован для навигации, выводы сверены с кодом. Обновлены матрица, контекст, аудит и предлагаемые этапы. Новые бизнес-правила не утверждались, приложение/схема/миграции не менялись.

Baseline: npm.cmd run lint/typecheck/build — PASS; npm.cmd test — 123 backend + 33 frontend PASS; npm.cmd run test:browser — PASS (foundation, staffing, метаданные отрядов; без сценариев детей/XLSX). Embedded PostgreSQL требует запуска вне sandbox: внутри uv_os_get_passwd ENOMEM. Миграции применены тестовыми раннерами на временной PostgreSQL. Проверка childCreateSchema подтвердила: отсутствие middleName допускается, пустая строка из формы отвергается. Production Telegram, staging, backup/restore и нагрузка не проверены. Graphify не перестраивался: исходники приложения не менялись; старый граф может содержать ссылки на удалённые инструкции.

## 2026-11-15 — приёмка среза 3А
- Исправлен browser smoke-сценарий перевода ребёнка: выбор отряда использует стабильный `select[name="squadId"]`, сценарий больше не зависит от неоднозначной label.
- Полные проверки вне sandbox: `npm.cmd test -- --run` — 127 backend + 40 frontend PASS; `npm.cmd run test:browser` — PASS (дети, размещение/перевод, XLSX preview/mapping/partial commit/idempotency/TTL/retry, права read-only, mobile/dark/reduced motion).
- `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build` — PASS. Срез 3А принят; 3Б (Squad CRUD и членство педсостава) остаётся следующим этапом после согласования lifecycle.

## 2026-11-15 � ����� 3�/3�: ������, ��������� � ������� �������
- ��������� ���������� Squad CRUD endpoints � ��������� active account, visibility, `squad.manage`, object scope � �������������� AuditLog. �������� ������ � ����������� ����������� ������������ FK/409.
- ��������� ������, ����������, ������� � ������ ��������������� ��������. ���������� ������� �������������� �������� � APPROVED application �� �� �� �����; �������� �� �������� ���������� ���� � �� �������� ����������� ���������.
- ��������� ��������� mutation endpoints ��� paymentStatus/paymentNote � checkinStatus, ������� ������������ �������� ������� ��� PARTIAL � field-level permissions. ��������� DailyMark upsert/list � ������������� member+date, scope � audit.
- Frontend �������� ������ ���������� ��������� � ��������� �������� ������/������ � ����������� TanStack Query.
- ��������: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build` � PASS; `npm.cmd test -- --run` �����������, �� embedded PostgreSQL � sandbox ����������� `uv_os_get_passwd ENOMEM`; frontend tests PASS.

## 2026-11-15 — этап 4, первый срез
Добавлены backend routes для BankEvent и ProgramItem, серверная авторизация/visibility/scope, Zod-валидация, транзакционный AuditLog и UI вкладки «Банк». Проверки: lint, typecheck, build — PASS; frontend tests — 40 PASS; backend integration suites не стартуют в окружении из-за uv_os_get_passwd ENOMEM (известный ограничитель embedded PostgreSQL). Файлы object storage, reorder/conflicts и proposals остаются открытыми.


## 2026-11-15 � �������� ������ ����� 4
��������� ������������ backend/UI ����� ����� � ���������. ������� ���������� ��� ��������� S3 � ClamAV �� ������������� ��� ����������; ������������� �������� ��������� ��������� � �������� �����.


## 2026-11-15 — оформление дорожной карты
Перестроен docs/IMPLEMENTATION-ROADMAP.md: единая сводка статусов, последовательные разделы этапов, выполненное отдельно от открытых задач и приёмки. Удалены повторы, повреждённый текст и буквальные escape-последовательности. Зафиксированы согласованные в сессии требования S3/ClamAV и правил программы как будущая реализация. Код приложения и приоритеты не менялись; завершение этапа 4 не заявлено. Проверки: строгая UTF-8, локальные ссылки Markdown и git diff --check.

## 2026-11-15 — этап 4: программа UI/API/PostgreSQL

- Прочитаны контекст, матрица, дорожная карта, ADR и разделы исходных требований о программе/банке. Существующий Graphify запрошен и сверен с исходниками. После начала правок проверен Git: исходные затронутые изменения принадлежат этой задаче; fetch origin выполнен, изменения перенесены из main в feat/stage4-program-api от origin/main. Commit/push/PR не выполнялись.
- Программа: UI CRUD, фильтр по дню на сервере, выбор ответственного с поиском/пагинацией, создание копии из банка, привязка/отвязка и просмотр доступного оригинала. DTO не раскрывает ID/название закрытого оригинала постороннему.
- ProgramWorkflowService: повторная проверка active/visibility/scope и полевых прав; program.edit, entertainment-only и содержимое своего пункта; проверка APPROVED-допуска/активности ответственного той же смены. Управление блокировкой; сериализация мутаций по Shift, CAS updatedAt и транзакционный аудит. Пересечения дают предупреждения, не запрет записи.
- Предложения: LEAD с допуском/ADMIN, own/admin list, пагинация, решения ADMIN PENDING→ACCEPTED/REJECTED с CAS. Решение не изменяет программу автоматически. История действий программы с автором/датой; имена изменённых полей в аудите, без полных снимков значений.
- Проверки финального кода: npm.cmd run lint — PASS; npm.cmd run typecheck — PASS; npm.cmd test — backend 134 PASS, frontend 40 PASS; npm.cmd run test:browser — PASS, включая build. Новый suite: 7 групп HTTP/PostgreSQL-проверок scope/PII/fields/locks/CAS/concurrency/rollback. Browser: CRUD из банка, original, ответственный, порядок, конфликты, предложение/решение, lock/unlock, история, удаление; 320/390 px, light/dark, без overflow/page errors. Скриншоты просмотрены.
- Sandbox блокировал embedded PostgreSQL (uv_os_get_passwd ENOMEM); после штатного разрешения вне sandbox тесты прошли. Промежуточные сбои браузерного теста выбора select исправлены; успешным считается финальный прогон.
- Изменений Prisma schema/миграций нет; тесты применили существующие миграции на временной PostgreSQL. Production БД и внешние сервисы не менялись. Собственное ревью выполнено по code-review; независимый review не выполнялся.
- Владелец подтвердил: S3 и ClamAV ещё не настроены. Upload/download/delete, проверка файлов, S3/ClamAV, orphan cleanup и файловый UI не реализованы и не засчитываются. Уведомления программы также не реализованы. Этап 4 остаётся частичным.
- `graphify update .` вне sandbox — PASS: граф кода 759 узлов/1760 связей. Graphify предупредил о ранее существующей смешанной кодировке FEATURE_MATRIX.md и DEVELOPMENT_LOG.md; семантическое обновление документов не заявляется. Новые фрагменты записаны в UTF-8 с сохранением прежних байтов. Локальные Markdown-ссылки и финальный git diff --check — PASS.


## 2026-11-15 — аудит этапов 3Б/3В/4

Фактический HEAD: e31831fcab163686294852cdd6605dffe647c427; отдельная ветка feat/stages-3b-3v-4-implementation.
3Б/3В: backend routes/services и миграция 202611150004_stage_3bc присутствуют, но UI lifecycle и полная mutation/browser/concurrency приёмка отсутствуют. squad.manage проверяется вместе с соответствующим field permission для оплаты/заезда.
Этап 4: программа/банк прошли существующую регрессию; BankEventFile остаётся только metadata schema без S3/ClamAV upload/download/delete/orphan cleanup и UI.
Исправлены повреждённые пользовательские строки состояния педсостава в frontend/src/Squads.tsx; массовая перекодировка не выполнялась.
Baseline: frontend tests PASS (40); lint/typecheck PASS; полный backend test BLOCKED на uv_os_get_passwd ENOMEM embedded PostgreSQL; Graphify CLI и gh CLI недоступны.
В CI добавлен browser smoke после установки Chromium; отдельная интеграционная приёмка файлов требует тестовых приватных S3 и ClamAV.

## 2026-11-15 — Stage 3Б

Реализована явная отвязка ShiftRole от Squad: отдельный PATCH с точным body, транзакционный AuditLog, сохранение position и полномочий, блокировка перевода/снятия последнего членства и обновление Staffing UI. Добавлен интеграционный сценарий с PostgreSQL для permission/no-op/conflict случаев. Полный набор проверок запускается после исправления оставшихся ошибок среды/кода.

## 2026-11-15 — Stage 3Б follow-up: detach review

Исходное дерево чистое; ветка fix/stage-3b-detach-review, HEAD и локальный origin/main = e081cb7bcce68aa1aedf171312896d956f3472b9. Ветка не переключалась; fetch/commit/push/merge/deploy не выполнялись.

Изменения: ADMIN-only кнопка отвязки «Руководитель»; refreshStaffing дополнительно инвалидирует squads/children (list/detail/placement/capabilities). Сохранены серверные правила, schema и migrations. Добавлены 8 frontend-тестов и 7 PostgreSQL regression tests. Browser smoke проверяет UI назначения, 409 реального API перевода, отмену подтверждения без записи, pending, 403/409/500/network errors с повтором, успешную отвязку без reload, историю и успешный перевод. Перехват HTTP используется только для frontend fault tests; успешный сценарий работает с Fastify/PostgreSQL.

Проверки:
- Baseline: Staffing frontend 15 PASS; staffing PostgreSQL 24 PASS вне sandbox.
- Целевые после изменений: Staffing frontend 23 PASS; staffing PostgreSQL 31 PASS.
- npm.cmd run generate — PASS.
- npm.cmd run db:validate — PASS с синтетическим DATABASE_URL только для валидации схемы, без подключения; первый запуск без переменной дал P1012.
- npm.cmd run lint — PASS; npm.cmd run typecheck — PASS.
- npm.cmd test — PASS: backend 142, frontend 48. Временные PostgreSQL проверили миграции, в том числе upgrade foundation с существующими данными.
- npm.cmd run test:browser — PASS; включает npm run build (backend + frontend PASS). Первый прогон упал на неоднозначном test locator для двух success-сообщений; сценарий исправлен закрытием формы назначения, повторный прогон прошёл полностью. Во время штатного restartApi зарегистрирован нефатальный proxy ECONNRESET.
- node --check scripts/browser-smoke.mjs и git diff --check — PASS.
- graphify update . — PASS вне sandbox; граф обновлён. Предупреждения: частичный AST-разбор Staffing.tsx и существующие невалидные UTF-8 фрагменты FEATURE_MATRIX/DEVELOPMENT_LOG. Новые записи добавлены UTF-8 без перекодировки исторических байтов.

Среда: PowerShell блокирует npm.ps1, использован npm.cmd. Sandbox блокирует системный user lookup embedded-postgres (uv_os_get_passwd ENOMEM) и launcher Graphify; повторные запуски вне sandbox успешны. Итоговых FAIL/BLOCKED проверок нет.

Ограничения: у перевода педсостава нет формы в текущем UI, поэтому browser вызывает реальный API той же session; полная UI-приёмка lifecycle Stage 3Б остаётся открытой. Межсессионного push-обновления нет: проверена текущая серверная авторизация при каждом запросе и локальная TanStack Query invalidation. Stage 3В/4 не развивались. Commit/push/PR оставлены владельцу; команды приведены в отчёте.
## 2026-11-17 — комплексное завершение 3Б/3В/4, рабочая точка

- После безопасного fetch origin/main = bab9e2987fbdc341420a5af2282f561966e28997; создана feat/stage-3b-completion. Исходное дерево чистое, открытых PR не найдено. Защищённые worktrees не менялись. Изменения этого задания пока не закоммичены и не объединены.
- 3Б: формы CRUD пустых отрядов, поиск APPROVED active сотрудников, multiple memberships, перевод/подтверждённое снятие, переход к отвязке должности, capabilities и история. Сервер: management scope не расширяется view_all, минимальные DTO, пагинация, повторное добавление/no-op без дублей аудита, защита связей и зависимостей.
- 3В: формы payment/checkin для детей и педсостава, PARTIAL note, двойные permissions, updatedAt CAS, сериализация по Shift, no-op и rollback audit. DailyMark list/filter/upsert, pagination, явная date-only, выбор today по существующему Shift.timeZone. Утверждение в промежуточном сообщении об отсутствии timezone было ошибочным и исправлено после чтения схемы. Новая политика timezone не вводится.
- Независимый read-only review выявил stale intent удаления уже переведённого членства и default sortOrder в partial PATCH. Исправлены snapshot expectedSquadId/updatedAt в UI/API и отдельная update schema; добавлены regression tests. Без снимка старые API-вызовы совместимы и сериализуются; новый UI всегда посылает снимок.
- Stage4 файлы: добавлены S3/ClamAV adapters, проверка MIME/содержимого/лимитов, защищённый upload/download/delete, idempotency, scan states, tombstones/cleanup, UI/progress/preview, tests и compose. Реальные S3/ClamAV НЕ проверены: Docker отсутствует; opt-in RUN_FILES_SERVICES тест пропускается явно.
- Регрессия банка: исправлено чтение собственных закрытых материалов в каталоге и найденный default isPublic/tags в partial PATCH; закрытый материал сохраняет приватность при изменении названия. PATCH повторяет active/scope в транзакции.
- Проверки на текущий момент: общий typecheck/lint PASS; целевые squads/staffing/date tests 54 PASS до последних review fixes. Полный прогон: 170 backend PASS, 1 FAIL на позднем fixture (накопленный rate limit), 1 real-service SKIP; frontend 64 PASS. API test instances изолированы между lifecycle tests, повтор ещё необходим.
- Browser smoke/build запускался: build PASS; выявлены ошибочные exact locators новых форм, исправлены; окончательного browser PASS ещё нет. Скрипт расширен полным lifecycle и file UI с ЯВНО тестовыми storage/scanner; это не реальная S3/ClamAV приёмка.
- Точка продолжения: завершить текущий browser прогон, полный npm test после исправлений; проверить файлы/security/миграцию и документацию; generate/db:validate/lint/typecheck/build/browser; обновить Graphify; оформить проверенные логические коммиты/PR без merge. Предыдущие вспомогательные агенты остановлены лимитом среды; основная сессия продолжает, фонового автоматического завершения нет.
- Бизнес-блокеры: архивирование заполненных отрядов и снятие членства с зависимыми DailyMark требуют отдельной политики. Существующие запреты сохранены. Локальный ведущий с squad.manage может создать отряд, но создание не даёт членство или view_own на него; автоматическая связь не добавлялась.

### Итог локальной приёмки и публикация, 2026-11-17

- generate/db:validate/lint/typecheck/build PASS. Полный npm test: 173 backend + 66 frontend PASS, 1 real-service SKIP. Финальный browser smoke PASS: PostgreSQL, 3Б/3В lifecycle, program regression, private bank edit и файловый UI с явно fake I/O, mobile/light/dark/reduced motion, retry и no overflow.
- Промежуточные browser ошибки exact locators, накопленного test rate-limit, restartApi/navigation и преждевременной проверки сохранения исправлены без ослабления production checks. generate сначала встретил занятый Prisma DLL, повтор после завершения browser PASS.
- PR #12: https://github.com/p0lack04/telegram_web_app_POKOMANDA/pull/12 ; commits a9e5c6f, dda7058. Общий Stage3 сервис и UI объединяют 3Б/3В в один PR. Stage4 ветка feat/stage4-files-integration основана на dda7058. Merge не выполнен.
- Реальная файловая приёмка локально BLOCKED: Docker отсутствует. Подготовлен CI job с изолированными MinIO/ClamAV, CLEAN/EICAR, границей 50 MiB, приватностью, удалением и orphan cleanup. До фактического PASS этого job Stage4 не закрыт.
- graphify update . PASS: нет новых изменений кода относительно предыдущего обновления графа; исторические предупреждения UTF-8/частичного AST сохраняются. При разделении коммитов PowerShell pipe испортил кодировку новой записи docs; исправлено отдельным коммитом dda7058 с явным UTF-8. Исторические байты сохранены.

- CI PR #12 выявил оставшийся импорт следующего среза при разделении: исправлено 2fbf487, typecheck PASS. CI PR #13 не смог скачать прежний minio/minio: pull access denied. Тестовая инфраструктура переведена на сборку официального source release 2025-10-15; bucket создаёт существующий AWS SDK, публичная policy удаляется. PR #13: https://github.com/p0lack04/telegram_web_app_POKOMANDA/pull/13 . Реальная приёмка ожидает повторного CI.

- Изолированный CI PR #12 PASS, включая browser: https://github.com/p0lack04/telegram_web_app_POKOMANDA/actions/runs/44071386686 . HEAD Stage3 2fbf4875cf6eccd5997d806df136a4608b6a13ac. Проверка объединяемости через read-only merge-tree не показала конфликтов; никакой merge не выполнялся.

## 2026-11-22 — подтверждение приёмки 3Б/3В/4

После паузы выполнен fetch: origin/main по-прежнему bab9e2987fbdc341420a5af2282f561966e28997. Изменения трёх этапов не объединены. PR #12 (2fbf487) CI PASS: https://github.com/p0lack04/telegram_web_app_POKOMANDA/actions/runs/44071386686 . PR #13 (2fa6251) оба job PASS: https://github.com/p0lack04/telegram_web_app_POKOMANDA/actions/runs/44071670113 .

Сервисный job действительно запущен с RUN_FILES_SERVICES=1: 13 tests PASS, включая реальные приватные MinIO/ClamAV CLEAN, EICAR INFECTED, 50 MiB INSTREAM, anonymous 403, download/delete/orphan cleanup. Прежний инфраструктурный BLOCKED снят. Browser использует fake file adapters, но реальные сервисы проверены отдельным тестом, эти доказательства не смешиваются.

Последняя UI-правка сокращает видимые подписи пагинации вложений на 320 px, сохраняя aria-label. Typecheck и 66 frontend tests PASS. Граф обновлён: 936 nodes/2242 edges; известные предупреждения исторической кодировки docs и частичного AST Staffing сохранены. Архивирование заполненных отрядов и новая политика удаления зависимых DailyMark остаются отдельными бизнес-вопросами. Следующий функциональный этап — 5, техзапросы и опросы.

Финальный локальный прогон 2026-11-22 после UI-правки: lint PASS; npm.cmd run test:browser PASS (включает backend/frontend build); весь 3Б/3В/program/file UI workflow на PostgreSQL, mobile/light/dark/reduced motion и network retry, без overflow/page errors.
