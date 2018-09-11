CREATE TABLE candlesticks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  exchange   VARCHAR(255) NULL,
  symbol     VARCHAR(255) NULL,
  period     VARCHAR(255) NULL,
  time       INTEGER          NULL,
  open       REAL         NULL,
  high       REAL         NULL,
  low        REAL         NULL,
  close      REAL         NULL,
  volume     REAL         NULL
);

CREATE UNIQUE INDEX unique_candle
  ON candlesticks (exchange, symbol, period, time);

CREATE INDEX time_idx ON candlesticks  (time);


CREATE TABLE candlesticks_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  income_at  BIGINT       NULL,
  exchange   VARCHAR(255) NULL,
  symbol     VARCHAR(255) NULL,
  period     VARCHAR(255) NULL,
  time       INTEGER      NULL,
  open       REAL         NULL,
  high       REAL         NULL,
  low        REAL         NULL,
  close      REAL         NULL,
  volume     REAL         NULL
);

CREATE INDEX candle_idx ON candlesticks_log (exchange, symbol, period, time);

CREATE TABLE ticker (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  exchange   VARCHAR(255) NULL,
  symbol     VARCHAR(255) NULL,
  ask        REAL         NULL,
  bid        REAL         NULL,
  updated_at INT          NULL
);

CREATE UNIQUE INDEX ticker_unique
  ON ticker (exchange, symbol);

CREATE TABLE ticker_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  exchange   VARCHAR(255) NULL,
  symbol     VARCHAR(255) NULL,
  ask        REAL         NULL,
  bid        REAL         NULL,
  income_at  BIGINT       NULL
);
CREATE INDEX ticker_log_idx ON ticker_log (exchange, symbol);

CREATE TABLE signals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  exchange   VARCHAR(255) NULL,
  symbol     VARCHAR(255) NULL,
  ask        REAL         NULL,
  bid        REAL         NULL,
  options    TEXT         NULL,
  side       VARCHAR(50)  NULL,
  strategy   VARCHAR(50)  NULL,
  income_at  BIGINT       NULL,
  state      VARCHAR(50)  NULL
);
CREATE INDEX symbol_idx ON signals (exchange, symbol);