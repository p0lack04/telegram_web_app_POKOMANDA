# База данных

Prisma schema: `backend/prisma/schema.prisma`; PostgreSQL. Foundation migration уже существует; не редактировать применённые миграции.

## Этап 2 — исходные модели
- Application: shiftId/userId/type, PENDING/APPROVED/REJECTED; unique(shiftId,userId,type), индексы userId и shiftId/type/status.
- ShiftRole: shiftId/userId/position/squadId?, unique(shiftId,userId,position), composite FK squad+shift. Несколько должностей допустимы; глобальная роль User отдельно.
- SquadMember — источник членства в отряде. Назначение должности не создаёт фиктивное членство.
- AuditLog: actor/action/entity/shift/details; не писать контакты, текст частных комментариев или Telegram secrets в details.
- Notification: собственный in-app inbox. Outbox/Preference существуют только как схема, Telegram delivery worker отсутствует.

## Применённая реализация этапа 2

- `202611110002_staffing`: non-null Application.version default 0 + CHECK version>=0; индексы userId/createdAt для заявок и ролей, shiftId/action/createdAt для audit.
- `202611110003_notification_scope`: nullable Notification.shiftId, FK Shift (RESTRICT), индекс. Inbox и mark-read соединяют с текущей visibility; legacy STAFFING без связи не выдаются (строки не удалены, автоматического backfill из текста нет).
- Проверено применение всех миграций на чистой временной PostgreSQL и foundation→002→003 с ранее созданными User/Shift/Application. Production БД не изменялась. Перед применением на постоянной БД — backup и `npm run db:deploy`; разрушительных операций нет.
- Scoped mutation создаёт AuditLog и Notification в той же транзакции; параллельные заявки/решения проверены реальными HTTP-тестами.

## Этап 3 — read-only Squad

D1/D2/D3/D14/D12 утверждены владельцем 2026-11-13; см. ADR-005 в [ARCHITECTURE](ARCHITECTURE.md). Первый срез использует существующие Squad/ShiftRole/SquadMember только для чтения. Prisma schema и миграции не изменяются. SELECT метаданных: id/name/color/sortOrder; members/roles используются только как EXISTS-фильтры scope, не выдаются в DTO. Допустимы несколько membership одного сотрудника в разных отрядах одной смены; существующие unique и staffing validations сохраняются. Модель Child identity, активное/завершённое членство, перевод, archivedAt/status и конфликт обязательности lastName остаются решениями будущих срезов, без миграций в этой задаче.

## Дети и XLSX import

Текущая схема уже содержит `SquadMember` и `ImportJob`, поэтому новая миграция не требуется. CHILD — запись `SquadMember` внутри `shiftId`; import job хранит preview JSON до одного часа, после commit заменяется обезличенным результатом. Исходный XLSX не сохраняется. FK `SquadMember.squad` с `ON DELETE RESTRICT` не позволяет удалить отряд с составом. Commit блокирует `Shift`, повторно проверяет scope и snapshot, а состояние `ImportJob` защищает от повторной записи.

## Миграционная стратегия
Аддитивные изменения отдельной миграцией. Application.version — optimistic concurrency для решений; история решений/назначений — AuditLog с subjectUserId в безопасных details. Новые индексы под собственные заявки/назначения и историю. Старые данные сохраняются, никаких TRUNCATE/reset/db push. Проверки: migrate deploy на чистую PostgreSQL + replay foundation→следующая миграция на данных foundation, сохранение строк и уникальности.

Изменение заявки/роли, аудит и уведомление должны фиксироваться одной транзакцией. Блокировка Shift сериализует admission/assignment/recruitment mutations одной смены; перечитывать user/status/visibility в транзакции. Для параллельных решений использовать status/version CAS. Нарушение unique — 409, не 500. Foreign keys нельзя считать заменой application policies.
