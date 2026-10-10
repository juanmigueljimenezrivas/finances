-- Esquema SQLite generado desde app/models.py (la fuente de verdad es SQLAlchemy)

CREATE TABLE users (
	id INTEGER NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	hashed_password VARCHAR(255) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (email)
);

CREATE TABLE accounts (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	bank VARCHAR(120) NOT NULL, 
	type VARCHAR(20) NOT NULL, 
	initial_balance NUMERIC(14, 2) NOT NULL, 
	opened_on DATE NOT NULL, 
	interest_rate NUMERIC(8, 4), 
	include_in_emergency BOOLEAN NOT NULL, 
	is_archived BOOLEAN NOT NULL, 
	color VARCHAR(16), 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_accounts_user_id ON accounts (user_id);

CREATE TABLE categories (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	kind VARCHAR(10) NOT NULL, 
	color VARCHAR(16) NOT NULL, 
	icon VARCHAR(8) NOT NULL, 
	is_system BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, kind, name), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_categories_user_id ON categories (user_id);

CREATE TABLE goals (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	kind VARCHAR(30) NOT NULL, 
	target_amount NUMERIC(14, 2) NOT NULL, 
	current_amount NUMERIC(14, 2) NOT NULL, 
	target_date DATE, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_goals_user_id ON goals (user_id);

CREATE TABLE investments (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	ticker VARCHAR(40) NOT NULL, 
	type VARCHAR(20) NOT NULL, 
	quantity NUMERIC(20, 8) NOT NULL, 
	buy_price NUMERIC(20, 6) NOT NULL, 
	current_price NUMERIC(20, 6) NOT NULL, 
	fees NUMERIC(14, 2) NOT NULL, 
	purchase_date DATE NOT NULL, 
	currency VARCHAR(3) NOT NULL, 
	provider VARCHAR(30) NOT NULL, 
	last_price_at DATE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_investments_user_id ON investments (user_id);

CREATE TABLE liabilities (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	kind VARCHAR(20) NOT NULL, 
	balance NUMERIC(14, 2) NOT NULL, 
	annual_rate NUMERIC(8, 4), 
	monthly_payment NUMERIC(14, 2), 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_liabilities_user_id ON liabilities (user_id);

CREATE TABLE mortgages (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	initial_principal NUMERIC(14, 2) NOT NULL, 
	annual_rate NUMERIC(8, 4) NOT NULL, 
	monthly_payment NUMERIC(14, 2), 
	start_date DATE NOT NULL, 
	end_date DATE NOT NULL, 
	balance_override NUMERIC(14, 2), 
	override_date DATE, 
	property_value NUMERIC(14, 2), 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_mortgages_user_id ON mortgages (user_id);

CREATE TABLE other_assets (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	kind VARCHAR(30) NOT NULL, 
	value NUMERIC(14, 2) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_other_assets_user_id ON other_assets (user_id);

CREATE TABLE user_settings (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	currency VARCHAR(3) NOT NULL, 
	emergency_months_target INTEGER NOT NULL, 
	return_conservative NUMERIC(8, 4) NOT NULL, 
	return_realistic NUMERIC(8, 4) NOT NULL, 
	return_optimistic NUMERIC(8, 4) NOT NULL, 
	inflation NUMERIC(8, 4) NOT NULL, 
	monthly_saving_override NUMERIC(14, 2), 
	fire_withdrawal_rate NUMERIC(8, 4) NOT NULL, 
	fire_annual_expenses_override NUMERIC(14, 2), 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE budgets (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	category_id INTEGER NOT NULL, 
	amount NUMERIC(14, 2) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, category_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(category_id) REFERENCES categories (id) ON DELETE CASCADE
);
CREATE INDEX ix_budgets_user_id ON budgets (user_id);

CREATE TABLE category_rules (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	pattern VARCHAR(200) NOT NULL, 
	category_id INTEGER NOT NULL, 
	match_type VARCHAR(10) NOT NULL, 
	priority INTEGER NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(category_id) REFERENCES categories (id) ON DELETE CASCADE
);
CREATE INDEX ix_category_rules_user_id ON category_rules (user_id);

CREATE TABLE price_history (
	id INTEGER NOT NULL, 
	investment_id INTEGER NOT NULL, 
	date DATE NOT NULL, 
	price NUMERIC(20, 6) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (investment_id, date), 
	FOREIGN KEY(investment_id) REFERENCES investments (id) ON DELETE CASCADE
);
CREATE INDEX ix_price_history_investment_id ON price_history (investment_id);

CREATE TABLE transactions (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	date DATE NOT NULL, 
	amount NUMERIC(14, 2) NOT NULL, 
	type VARCHAR(10) NOT NULL, 
	account_id INTEGER NOT NULL, 
	to_account_id INTEGER, 
	category_id INTEGER, 
	description VARCHAR(500) NOT NULL, 
	notes TEXT NOT NULL, 
	import_hash VARCHAR(40), 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_tx_amount_positive CHECK (amount > 0), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(account_id) REFERENCES accounts (id) ON DELETE CASCADE, 
	FOREIGN KEY(to_account_id) REFERENCES accounts (id) ON DELETE CASCADE, 
	FOREIGN KEY(category_id) REFERENCES categories (id) ON DELETE SET NULL
);
CREATE INDEX ix_transactions_category_id ON transactions (category_id);
CREATE INDEX ix_transactions_account_id ON transactions (account_id);
CREATE INDEX ix_tx_user_date ON transactions (user_id, date);
CREATE INDEX ix_transactions_import_hash ON transactions (import_hash);
CREATE INDEX ix_transactions_user_id ON transactions (user_id);

