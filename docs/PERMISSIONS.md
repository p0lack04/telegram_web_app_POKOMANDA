# Права: staffing и Squad read-only

## Squad read-only (этап 3, D1/D2/D3/D14/D12 APPROVED — 2026-11-13)

Порядок проверок: active account → visibility смены → итоговый permission set → object scope. `squad.view_all` разрешает все отряды конкретной доступной смены. Иначе `squad.view_own` разрешает только отряды со связью через `ShiftRole.squadId` либо `SquadMember.userId` при совпадении user/shift/squad. Источники объединяются; null squadId не является связью. Membership само по себе permissions не создаёт. Несколько членств одной смены допустимы, но не повышают права до `view_all`. `squad.manage` не заменяет права просмотра.

| Endpoint / условие | Результат |
|---|---|
| List + view_all | Все отряды конкретной доступной смены |
| List + только view_own | Только связанные отряды; фильтрация в БД до пагинации/count |
| List видимой смены без view permissions | 403, даже при наличии membership |
| Detail | Тот же object scope, что у list |
| Несуществующий/чужой/недоступный squad или неверная пара shift+squad | 404 без раскрытия существования |
| Невидимая/несуществующая смена | 404 |
| Нет auth / inactive account | Существующие 401 / 403 ACCOUNT_NOT_READY |

DTO отряда — только `id/name/color/sortOrder`. Без количества участников, состава, CRUD, DailyMark и персональных полей. `ROLE_PERMISSIONS` и staffing не меняются. Staffing metadata сохраняет существующий id/name список для менеджеров должностей.

## Staffing

Базовый каталог — `backend/src/domain/permissions.ts`, authentication — существующий AuthService. Новый модуль обязан сначала проверить active account и видимость смены, затем действие и target scope.

| Действие | Доступ |
|---|---|
| Видимые смены | CONFIRMED + onboarded, фильтр visibility |
| Подать заявку | собственная identity; LEAD→LEAD_RECRUIT, TRAINEE→TRAINEE_RECRUIT; соответствующий набор открыт |
| Мои заявки/назначения/история | только собственные записи и видимые смены |
| Все заявки смены / решение / ручное добавление | ADMIN |
| Открыть/закрыть набор, сменить этап | ADMIN |
| Минимальный принятый персонал | ADMIN или shift.manage_roles в данной видимой смене |
| Назначить/снять должность | ADMIN или shift.manage_roles; target принят и active |
| Назначить/снять «Руководитель» | только ADMIN, также на сервере |
| Привязать должность к отряду | дополнительно тот же shift + target состоит в squad |
| История всей смены | ADMIN / shift.manage_roles, без чужих анкетных решений у не-ADMIN |
| Уведомления | только собственный inbox |

API не меняет User.role, accountStatus или чужой userId через подачу заявки. Минимальный DTO сотрудника содержит ID, ФИО, глобальную роль; не включает телефон, Telegram ID, дату рождения, документы или приватные комментарии. Отдельные решения не отменяют ранее выданные назначения — пересмотр закрытой заявки не реализуется в этом этапе.
