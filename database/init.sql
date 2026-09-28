-- ============================================================
-- OMAR — Schéma de base de données
-- PostgreSQL 15
-- Les tables sont créées automatiquement par SQLAlchemy au
-- démarrage du backend. Ce fichier sert de référence et peut
-- être utilisé pour recréer la base à zéro sans le backend.
-- ============================================================

-- Extension pour la recherche full-text avec accents
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- PRODUITS
-- Un produit = une référence (code-barre unique)
-- Les données nutritionnelles viennent d'OpenFoodFacts
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id               SERIAL PRIMARY KEY,
    barcode          VARCHAR(50)  NOT NULL UNIQUE,          -- EAN-13, EAN-8, QR…
    name             VARCHAR(255) NOT NULL,
    brand            VARCHAR(150),
    category         VARCHAR(150),
    image_url        TEXT,
    description      TEXT,
    selling_price    NUMERIC(10, 2),                        -- prix de vente unitaire
    unit             VARCHAR(50),                           -- "1L", "500g", "x6"…

    -- Open Food Facts
    nutriscore_grade VARCHAR(2),                            -- a b c d e
    nova_group       INTEGER,                               -- 1-4
    ecoscore_grade   VARCHAR(20),                           -- a-plus a b c d e
    allergens        TEXT,                                  -- liste séparée par virgules
    labels           TEXT,                                  -- "bio, commerce équitable…"
    nutrition_per_100g TEXT,                                -- JSON : {"energy_kcal":..., "proteins":...}

    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_barcode  ON products (barcode);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- ============================================================
-- LOTS DE STOCK (FIFO)
-- Chaque réception crée un lot. La vente déstocke le plus
-- ancien lot en premier (FIFO).
-- ============================================================
CREATE TABLE IF NOT EXISTS lots (
    id             SERIAL PRIMARY KEY,
    product_id     INTEGER      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity       INTEGER      NOT NULL DEFAULT 0,          -- unités restantes dans ce lot
    purchase_price NUMERIC(10, 2),                          -- prix d'achat unitaire (coût)
    expiry_date    DATE,                                     -- date de péremption
    supplier       VARCHAR(150),                            -- nom du fournisseur
    notes          TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP      -- date de réception = date d'achat
);

CREATE INDEX IF NOT EXISTS idx_lots_product_id ON lots (product_id);
CREATE INDEX IF NOT EXISTS idx_lots_expiry    ON lots (expiry_date);

-- ============================================================
-- TRANSACTIONS (VENTES)
-- Une transaction = un passage en caisse
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    id                  SERIAL PRIMARY KEY,
    invoice_number      VARCHAR(50) NOT NULL UNIQUE,         -- ex : "F-20260919-001"
    created_at          TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    total               NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- montant total
    amount_paid         NUMERIC(10, 2) DEFAULT 0,            -- montant remis par le client
    change_given        NUMERIC(10, 2) DEFAULT 0,            -- monnaie rendue
    payment_method      VARCHAR(30),                         -- cash | card | check | mixed
    status              VARCHAR(20)  DEFAULT 'completed',    -- completed | partial | cancelled
    notes               TEXT,
    is_custom_invoice   BOOLEAN      DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice    ON transactions (invoice_number);

-- ============================================================
-- ARTICLES DE TRANSACTION
-- Lignes de détail d'une vente
-- product_id peut être NULL pour les articles "personnalisés"
-- lot_id indique quel lot a été déstocké (traçabilité)
-- ============================================================
CREATE TABLE IF NOT EXISTS transaction_items (
    id               SERIAL PRIMARY KEY,
    transaction_id   INTEGER        NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id       INTEGER        REFERENCES products(id) ON DELETE SET NULL,
    lot_id           INTEGER        REFERENCES lots(id)     ON DELETE SET NULL,
    product_name     VARCHAR(255)   NOT NULL,               -- copié au moment de la vente
    product_barcode  VARCHAR(50),
    quantity         NUMERIC(10, 3) NOT NULL DEFAULT 1,     -- supporte les fractions (kg…)
    unit_price       NUMERIC(10, 2) NOT NULL,               -- prix unitaire au moment de la vente
    total_price      NUMERIC(10, 2) NOT NULL,               -- quantity × unit_price
    is_custom        BOOLEAN        DEFAULT FALSE            -- article saisi manuellement
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_tx  ON transaction_items (transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_pid ON transaction_items (product_id);

-- ============================================================
-- EMPLOYÉS
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    role       VARCHAR(100),
    email      VARCHAR(255),
    phone      VARCHAR(30),
    color      VARCHAR(7)  DEFAULT '#3B82F6',               -- couleur hex pour le planning
    is_active  BOOLEAN     DEFAULT TRUE,
    created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PLANNING (CRÉNEAUX HORAIRES)
-- ============================================================
CREATE TABLE IF NOT EXISTS schedules (
    id              SERIAL PRIMARY KEY,
    employee_id     INTEGER   NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    start_datetime  TIMESTAMP NOT NULL,
    end_datetime    TIMESTAMP NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_schedule_dates CHECK (end_datetime > start_datetime)
);

CREATE INDEX IF NOT EXISTS idx_schedules_employee ON schedules (employee_id);
CREATE INDEX IF NOT EXISTS idx_schedules_dates    ON schedules (start_datetime, end_datetime);
