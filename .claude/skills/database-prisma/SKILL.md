---
name: database-prisma
description: Проектирование PostgreSQL/Prisma схемы, миграций и целостности данных.
---
# Database / Prisma

- Сначала проверь текущую БД и ORM; не создавай вторую схему параллельно.
- Уточни cardinality и ownership для Shift, ShiftRole, Squad, SquadMember, ProgramItem, BankEvent, TechRequest, Survey.
- Глобальная роль User и должности пользователя на смене — разные сущности/измерения.
- Разреши участника без User для CHILD; запрети некорректные комбинации через constraints/validation.
- Добавь уникальные ограничения для членства, дневных отметок, ответов, назначений и внешних идентификаторов там, где это соответствует правилам.
- Не дублируй один FK в обеих моделях без необходимости; для 1:1/1:N зафиксируй единственный владеющий FK.
- Индексы проектируй по реальным фильтрам: shiftId, squadId, userId, date, status, createdAt.
- Для оплаты partial уточни хранение суммы/комментария/подтверждения; одного enum может быть недостаточно.
- Для SurveyAnswer рассмотри SurveySubmission + unique(userId, surveyId), если один проход на опрос.
- Файлы храни в object storage; в БД только metadata, storage key, checksum, MIME, size, uploader, access scope.
- Миграции именуй осмысленно; не редактируй уже применённые миграции.
- Seed — только для dev/test и не должен содержать реальные персональные данные.
- Добавь тесты на cascade/restrict, uniqueness, транзакционные rollback.
