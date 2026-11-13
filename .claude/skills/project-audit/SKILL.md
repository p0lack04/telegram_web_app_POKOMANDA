---
name: project-audit
description: Полный аудит при неизвестной или существенно изменившейся структуре либо по запросу; не для каждого исправления.
---
# Project audit

Сначала используй docs/PROJECT_CONTEXT.md и docs/FEATURE_MATRIX.md. Не повторяй полный аудит и уже выполненное исследование без технической причины; ограничь поиск согласованным scope.

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
Обновляй существующие docs/FEATURE_MATRIX.md, docs/ARCHITECTURE.md и docs/DEVELOPMENT_LOG.md по scope, не создавай копий. Результат: baseline, findings с file:line, delta матрицы и критерии приёмки.
