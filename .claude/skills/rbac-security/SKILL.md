---
name: rbac-security
description: Серверная безопасность, RBAC по должностям смены и защита персональных данных.
---
# RBAC and security

- Разделяй authentication (кто пользователь) и authorization (что он может).
- Глобальные роли: ADMIN/LEAD/TRAINEE; permissions выдаются также должностями на конкретной Shift.
- Введи единый каталог permission strings и централизованный resolver `hasPermission(user, shift, permission)`.
- Проверяй membership и видимость Shift до загрузки связанных данных; избегай IDOR.
- Для Squad ограничивай `view_own` конкретными отрядами пользователя; `view_all` — отдельное право.
- Для редактирования полей участника проверяй каждое поле, а не только доступ к форме.
- Комментарии о стажёрах/кандидатах доступны только явно разрешённым ролям и в контексте смены.
- Скрытие UI-кнопок не заменяет серверную проверку.
- Не включай приватные комментарии/документы/контакты в общие DTO и логи.
- Проверь CSRF/CORS/cookie policy, rate limiting, brute force, input validation, output encoding.
- Файлы: проверка MIME magic bytes, расширения, лимита, malware scan по возможности, приватные signed URLs с TTL.
- Не используй `dangerouslySetInnerHTML` для недоверенных данных без sanitizer.
- Создай матрицу permission × endpoint × resource scope и негативные тесты.
