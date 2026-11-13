---
name: project-audit
description: Аудит существующего репозитория, выявление заглушек, карта функций и план безопасной модернизации.
---
# Project audit

1. Сними дерево репозитория и определи entrypoints, package manager, scripts, frontend/backend, DB, deployment, tests.
2. Прочитай README, manifests, env examples, migrations, workflows и исходные ключевые модули.
3. Запусти baseline-команды из package scripts. Не исправляй всё подряд до фиксации исходного состояния.
4. Для каждой функции составь матрицу: экран/действие | компонент | источник данных | persistence | API | auth | permission | тест | статус.
5. Найди симуляции: in-memory store, seed users, fake JWT, задержки вместо запросов, mock upload, генераторы данных, фальшивый импорт.
6. Проверь TODO/FIXME, неработающие обработчики, `console.log`, небезопасный HTML, хардкод secrets, отсутствие error states.
7. Проверь модель данных на дублирующие связи, nullable/unique/index, cascade rules, транзакции.
8. Отдельно проверь privacy/PII и несовершеннолетних.
9. Составь риски P0/P1/P2 и план вертикальных срезов с критериями приёмки.
10. Не делай destructive rewrite. Не удаляй рабочий сценарий без эквивалента.
Вывод: `docs/audit/BASELINE.md`, `docs/audit/FEATURE-MATRIX.md`, `docs/architecture/DECISIONS.md` (если проект уже использует docs — следуй его структуре).
