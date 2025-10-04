# iChecker

Необходимо установить
1. Bun js v1.2.22 или выше (https://bun.com/)
2. Установить postgres (https://www.postgresql.org/)
3. Установить pm2 (https://pm2.io/)

Шаги запуска
1. Добавить файл .env, заполненный по образцу (.env.example)
2. Прописать в папке проекта bun install
3. Прописать в папке проекта bun build_server
4. Прописать pm2 start (путь к папке проекта)/server --name iChecker (название проекта)
5. Прописать pm2 save
6. Прописать pm2 startup (запускает приложение при перезапуске сервера)


