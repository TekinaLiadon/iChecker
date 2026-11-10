# iChecker

Telegram-бот, который следит за реестром Минюста, хранит агентов в PostgreSQL, сопоставляет их с Кинопоиском и отдаёт данные в чат + xlsx-таблицей.

## Требования

- Bun не ниже 1.4.2 (требование bunsql-native-migrate 0.6.2) — https://bun.com/
- PostgreSQL + postgresql-client (`pg_dump`/`pg_restore`) — https://www.postgresql.org/
- Node.js и npm, нужны для установки pm2 (`npm install -g pm2`)
- pm2 — https://pm2.io/

## Переменные окружения

Файл `.env` заполняется по образцу `.env.example`:

- `BOT_TOKEN` — токен бота;
- `BOT_CHAT` — числовой id чата рассылки, бот должен состоять в этом чате;
- `POSTGRES_URL` — подключение к БД; этот же ключ используют CLI миграций, `bun run backup`/`restore` и сам бот;
- `KINOPOISK_TOKEN` — ключ api.kinopoisk.dev;
- `IS_DEV` — лог в консоль вместо `logs/app.log` (необязательна, по умолчанию false).

## Запуск

1. Добавить файл `.env`, заполненный по образцу (`.env.example`) с адресом будущей базы в `POSTGRES_URL`
2. Прописать в папке проекта `bun install`
3. Создать БД с таблицами командой (берёт всё из `POSTGRES_URL`, повторный запуск безопасен):

```sh
bun run db:create
```
4. Прописать в папке проекта `bun run build_server`
5. Прописать `pm2 start server --name iChecker` (находясь в папке проекта, либо путь до server)
6. Прописать `pm2 save`
7. Прописать `pm2 startup` (команда напечатает строку для автозапуска, выполнить её с sudo, после этого приложение поднимается при перезапуске сервера)

### Поведение БД при старте

Миграции из `migrations/` применяются автоматически (bunsql-native-migrate) до старта бота:

- легаси-схема без таблицы `migrations` автоматически базлайнится — история помечается применённой без выполнения DDL;
- пустая БД после миграций автоматически заполняется реестром Минюста.

## Команды

| Команда | Назначение |
| --- | --- |
| `bun run dev` | запуск в watch-режиме (`01-app/index.ts`) |
| `bun run build_server` | сборка бинарника `./server` (`--compile`, `--minify`) |
| `bun run db:create` | создать БД из `POSTGRES_URL` и применить миграции — таблицы на месте (если их ещё нет) |
| `bun run migrate` | применить миграции (bunsql-native-migrate up) |
| `bun run migrate:status` | статус миграций |
| `bun run migrate:mark` | baseline: пометить все миграции применёнными без выполнения |
| `bun run backup` | бекап БД: `pg_dump` (данные `agents` и `info`) в `backups/` |
| `bun run restore <файл>` | восстановление БД из дампа: миграции + `TRUNCATE` + `pg_restore --data-only` |
| `bun run pack` | архив карточек из `uploads/` в `backups/` |
| `bun run unpack <файл>` | распаковка архива карточек в `uploads/` |

## Бекап и восстановление

- Бекап — стандартный `pg_dump`: custom-формат, только данные таблиц `agents` и `info`, без таблицы `migrations`; файл `backups/ichecker-db-ГГГГММДД-ЧЧММсс.dump`.
- Версия `pg_dump`/`pg_restore` должна быть не ниже версии сервера PostgreSQL — с более новым сервером клиент отказывается работать (`server version mismatch`).
- Восстановление (`bun run restore <файл>`) — сначала миграции через либу (или baseline для легаси-схемы), затем `TRUNCATE` таблиц и заливка данных `pg_restore --data-only`; отдельно миграции запускать не нужно.
- Автоматический бекап — строка в `crontab -e` (путь до bun можно узнать через `which bun`):

```cron
0 4 * * * cd /path/to/iChecker && /home/user/.bun/bin/bun run backup >> logs/backup.log 2>&1
```

### Накат бекапа на текущей машине

Восстановление делают при остановленном боте, иначе планировщик успеет залить свежий реестр поверх восстановленных данных.

```sh
pm2 stop iChecker
bun run restore backups/ichecker-db-ГГГГММДД-ЧЧММсс.dump
pm2 start iChecker
```

Restore меняет только данные таблиц `agents` и `info`, каталог карточек `uploads/` не трогает. Если нужны карточки на момент дампа, распаковать парный архив (штамп времени у дампа и архива совпадает):

```sh
bun run unpack backups/ichecker-cards-ГГГГММДД-ЧЧММсс.tar.gz
```

Архив распаковывается в `uploads/` каталога, из которого выполняется команда, — по умолчанию это каталог проекта, он же рабочая директория бота. Бот отдаёт карточки по пути `process.cwd()/uploads/<имя файла из info.img>`, поэтому распаковывать нужно именно туда: внутри архива файлы лежат без префикса каталога, и `unpack` доливает их поверх существующих, ничего не удаляя. Без распакованного архива база консистентна, но карточки агентов без файлов в `uploads/` не отправятся.

Если заливка упала посреди `pg_restore`, база может остаться залитой частично. Повторный запуск `bun run restore` безопасен: перед заливкой он снова очищает таблицы через `TRUNCATE`.

## Перенос на новый сервер

На старом сервере:

```sh
bun run backup
bun run pack
```

Передать на новый сервер `.env` и оба файла из `backups/` (дамп БД и архив карточек) — секреты вне git.

На новом сервере:

1. `git clone <репозиторий>` и перейти в каталог проекта
2. Создать `.env` по образцу `.env.example`
3. `bun install`
4. Создать БД с таблицами командой `bun run db:create` (адрес базы — в `POSTGRES_URL` из `.env`)
5. `bun run build_server`
6. `bun run restore backups/ichecker-db-....dump` — миграции применит сам restore
7. `bun run unpack backups/ichecker-cards-....tar.gz`
8. `pm2 start server --name iChecker`
9. `pm2 save`
10. `pm2 startup`

## Замечания

- Все пути относительные — команды и запуск выполняются из каталога проекта.
- Рядом с `./server` нужны `migrations/` и `native-stage/` — появляются в каталоге проекта при клонировании и сборке (`bun run build_server`), отдельно переносить не нужно.
- Если на сервере уже базлайнилась старая версия миграции, выполнить:

```sql
UPDATE migrations SET migration = '8207048194434_2026_10_25_baseline_agents_info.ts' WHERE migration = '9999000000000_baseline_agents_info.ts';
```
