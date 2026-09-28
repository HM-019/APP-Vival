.PHONY: up down build rebuild logs restart clean ps shell-backend shell-db ssl-self-signed

# ── Démarrage / arrêt ────────────────────────────────────────────────────────

up:
	docker compose up -d

down:
	docker compose down

# Reconstruction complète + redémarrage (à lancer après chaque modif de code)
rebuild:
	docker compose build --no-cache frontend backend
	docker compose up -d

build:
	docker compose build --no-cache

restart:
	docker compose restart

# ── Logs ─────────────────────────────────────────────────────────────────────

logs:
	docker compose logs -f

logs-front:
	docker compose logs -f frontend

logs-back:
	docker compose logs -f backend

logs-nginx:
	docker compose logs -f nginx

# ── Maintenance ───────────────────────────────────────────────────────────────

ps:
	docker compose ps

clean:
	docker compose down -v --remove-orphans
	docker system prune -f

# ── Shells ────────────────────────────────────────────────────────────────────

shell-backend:
	docker compose exec backend bash

shell-db:
	docker compose exec db psql -U omar -d omardb

# ── HTTPS — générer un certificat auto-signé (dev/LAN) ───────────────────────
# Lance ensuite : décommentez le bloc HTTPS dans nginx/nginx.conf
ssl-self-signed:
	mkdir -p nginx/ssl
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
	  -keyout nginx/ssl/key.pem \
	  -out nginx/ssl/cert.pem \
	  -subj "/C=FR/ST=France/L=Local/O=OMAR/CN=omar.local"
	@echo ""
	@echo "Certificat généré dans nginx/ssl/"
	@echo "Ajoutez le volume et décommentez le bloc HTTPS dans nginx/nginx.conf"
