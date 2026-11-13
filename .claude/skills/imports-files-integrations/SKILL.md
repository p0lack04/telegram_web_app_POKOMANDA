---
name: imports-files-integrations
description: Надёжный импорт участников и Google Sheets, загрузка файлов и Telegram уведомления.
---
# Imports, files and integrations

## CSV/XLSX
- Ограничь типы/размер, проверь encoding, заголовки и обязательные колонки.
- Сначала parse → normalize → validate → preview → explicit confirm → transactional persist.
- Покажи ошибки по строкам и колонкам; поддержи частичное принятие только если это явно задано.
- Защищайся от формул spreadsheet при экспорте (formula injection).
- Дедупликация по согласованным ключам; не объединяй людей только по имени.
- Логируй автора, время, исходный файл/хэш и сводку импорта без избыточной PII.

## Google Sheets
- Не симулируй содержимое по ID таблицы.
- Выбери реальный способ доступа: Google OAuth/service account или разрешённый CSV export; ключи только backend.
- Явно показывай ошибки доступа/формата и импортируй только после preview.

## Files
- Upload через backend presigned flow или multipart; никогда не доверяй client MIME.
- Разделяй категории документов и медиа, применяй лимиты на сервере.
- Храни приватно; БД содержит metadata/storage key/checksum/owner/access scope.
- Скачивание проходит авторизацию; URL короткоживущие.
- Поддержи удаление/замену, orphan cleanup и аудит.

## Telegram bot
- Токен только в server env; webhook secret/token verification.
- Отправки через очередь/retry/backoff, ограничение rate и идемпотентность.
- Храни Telegram chat/user linkage после подтверждения; не рассылай без opt-in/правового основания.
- Не показывай пользователю «отправлено», пока backend не подтвердил результат.
