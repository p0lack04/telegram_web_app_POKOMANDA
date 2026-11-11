# Baseline — 2026-11-11

## Инвентаризация
Рабочая ветка main — unborn (нет коммитов). Исходные незакоммиченные файлы: CLAUDE.md, 1.txt (693 строки), 2.txt (1039 строк), 3.txt (4418 строк), 9 skills, 5 agent instructions, 2 существующих документа. Все прочитаны полностью. TXT сохраняются без изменений.

Рабочих package manifests, entrypoints, env, migrations, tests, CI нет. README в рабочем дереве отсутствует. В origin/main (7487db6, start) обнаружены 24 файла каркаса Fastify 4 / Prisma 5 / React 18 / Vite 5 / TanStack Query / Zustand. Это локальная git-ссылка, не подтверждение актуального состояния сервера. Не выполнялись checkout/reset/merge, пользовательские файлы не перезаписывались.

## Выполненные команды до изменений
- `git status --short`: только untracked исходные материалы.
- `git log -5 --oneline`: ошибка — main не имеет коммитов.
- `git log origin/main -5 --oneline`: 7487db6 start.
- `git diff --stat`: пустой diff (untracked не показываются).
- `git ls-tree -r --name-only origin/main`: 24 файла.
- `node --version`: v26.13.0; `npm --version`: 11.20.0.
- `docker --version`, `psql --version`: command not found.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`: все ENOENT package.json.
- install не запускался до появления manifest; существующих install scripts нет.

## Исходное состояние
Ни одна production-функция не подтверждена. Демо — JSX с локальным store, искусственными задержками, поддельным JWT, генератором Google Sheets, object/data URL вместо загрузки и симулятором бота. Данные всех пользователей, детей, приватных комментариев доступны в памяти браузера независимо от скрытых вкладок.

## Риски
P0: нет доверенной identity, серверного RBAC, persistence и privacy boundary. Массовый Object.assign позволяет изменение незапланированных полей. Право squad.manage не ограничено своим отрядом. Авторизация/visibility проверяется не во всех дочерних действиях.
P1: повторные ответы перезаписываются, import совпадает только по имени, отсутствуют транзакции, проверки referential integrity и реальная доставка уведомлений. Удаление отряда ошибочно фильтрует дневные отметки.
P2: условные React hooks, неочищенные BackButton callbacks, нет focus trap/aria у модалок, fake loading, недостаточные touch targets, нет reduced motion.

Следующие проверки и фактический статус реализации фиксируются отдельно; этот файл сохраняет baseline ДО изменений.
