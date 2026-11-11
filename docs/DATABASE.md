# База данных

Prisma schema: `backend/prisma/schema.prisma`; PostgreSQL. Foundation migration уже существует; не редактировать применённые миграции.

## Этап 2 — исходные модели
- Application: shiftId/userId/type, PENDING/APPROVED/REJECTED; unique(shiftId,userId,type), индексы userId и shiftId/type/status.
- ShiftRole: shiftId/userId/position/squadId?, unique(shiftId,userId,position), composite FK squad+shift. Несколько должностей допустимы; глобальная роль User отдельно.
- SquadMember — источник членства в отряде. Назначение должности не создаёт фиктивное членство.
- AuditLog: actor/action/entity/shift/details; не писать контакты, текст частных комментариев или Telegram secrets в details.
- Notification: собственный in-app inbox. Outbox/Preference существуют только как схема, Telegram delivery worker отсутствует.

## Миграционная стратегия
Аддитивные изменения отдельной миграцией. Application.version — optimistic concurrency для решений; история решений/назначений — AuditLog с subjectUserId в безопасных details. Новые индексы под собственные заявки/назначения и историю. Старые данные сохраняются, никаких TRUNCATE/reset/db push. Проверки: migrate deploy на чистую PostgreSQL + replay foundation→следующая миграция на данных foundation, сохранение строк и уникальности.

Изменение заявки/роли, аудит и уведомление должны фиксироваться одной транзакцией. Блокировка Shift сериализует admission/assignment/recruitment mutations одной смены; перечитывать user/status/visibility в транзакции. Для параллельных решений использовать status/version CAS. Нарушение unique — 409, не 500. Foreign keys нельзя считать заменой application policies.
