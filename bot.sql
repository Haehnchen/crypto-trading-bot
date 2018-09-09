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