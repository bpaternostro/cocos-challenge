.PHONY: help install env migrate dev start test test-unit test-functional setup docker-up docker-down docker-logs

help:
	@echo "Comandos disponibles:"
	@echo "  make setup            - Instala dependencias y prepara .env si no existe"
	@echo "  make install          - Instala dependencias npm"
	@echo "  make env              - Crea .env desde .env.example si no existe"
	@echo "  make migrate          - Ejecuta migraciones e índices en PostgreSQL"
	@echo "  make dev              - Inicia el servidor en modo watch (desarrollo)"
	@echo "  make start            - Inicia el servidor en modo producción"
	@echo "  make test             - Ejecuta toda la suite de tests (unitarios + funcionales)"
	@echo "  make test-unit        - Ejecuta solo tests unitarios"
	@echo "  make test-functional  - Ejecuta solo tests funcionales contra TEST_DATABASE_URL"
	@echo "  make docker-up        - Levanta API en Docker usando .env"
	@echo "  make docker-down      - Detiene los contenedores de Docker"
	@echo "  make docker-logs      - Muestra logs de la API en Docker"

install:
	npm install

env:
	@if [ ! -f .env ]; then cp .env.example .env && echo "Creado .env desde .env.example. Configura DATABASE_URL y TEST_DATABASE_URL."; else echo ".env ya existe."; fi

migrate:
	npm run db:migrate

dev:
	npm run dev

start:
	npm start

test:
	npm test

test-unit:
	npm run test:unit

test-functional:
	npm run test:functional

lint:
	npm run lint

setup: install env
	@echo "Setup listo. Verifica tus variables en .env y luego ejecuta 'make migrate' y 'make dev'."

docker-up:
	@if [ ! -f .env ]; then echo "ERROR: Falta el archivo .env en la raíz del proyecto."; exit 1; fi
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f api
