# Crypto Trading Bot

[![Build Status](https://github.com/Haehnchen/crypto-trading-bot/actions/workflows/node.js.yml/badge.svg)](https://github.com/Haehnchen/crypto-trading-bot/actions/workflows/node.js.yml)

A cryptocurrency trading bot supporting multiple exchanges via [CCXT](https://github.com/ccxt/ccxt).

**Not production ready** only basic functionality

## Features

- Multi pair support in one instance
- sqlite3 storage for candles, tickers, ...
- Webserver UI with dashboard
- Support for going "Short" and "Long"
- Signal browser dashboard for pairs
- Slack, Telegram and email notification
- Profile-based bot management with strategy execution
- CCXT-based exchange support (100+ exchanges)

## Technical stuff and packages

- node.js
- sqlite3
- [technicalindicators](https://github.com/anandanand84/technicalindicators)
- [TA-Lib](https://mrjbq7.github.io/ta-lib/)
- [CCXT](https://github.com/ccxt/ccxt)
- Tailwind CSS 4
- Tradingview widgets

## How to use

### [optional] Preinstall

For building sqlite and indicators libraries (if needed)

```
sudo apt-get install build-essential
```

### Start

```
npm install --production
npm start
```

```
# or with special port
# npm start -- --port=55555
```

```
open browser: http://127.0.0.1:8080
```

## Web UI

### Dashboard

![Webserver UI](documentation/cryptobot.png 'Webserver UI')

### Trades / Positions / Orders

![Webserver UI](documentation/trades.png 'Trades / Positions / Orders')

### Manual Orders

![Webserver UI](documentation/manual_order.png 'Manual Orders')

## Build In Strategies

Common strategies with indicators are inside, which most of the time are not profitable. See some more advanced strategies in the list below

- [dip_catcher](src/strategy/strategies/dip_catcher/README.md)
- [dca_dipper](src/strategy/strategies/dca_dipper/README.md) - **Long term invest** Dollar-Cost Averaging (DCA) Dip Investor Strategy

Find some example strategies inside [src/strategy/strategies](src/strategy/strategies)

## Custom Strategies

For custom strategies use [var/strategies](var/strategies) folder.

```
# simple file structure
var/strategies/your_strategy.js

# or wrap strategy into any sub folder depth
var/strategies/my_strategy/my_strategy.js
```

## Signals

### Slack

![Webserver UI](documentation/slack_signals.png 'Slack signals')

## Tests

```
npm test
```

### Security / Authentication

As the webserver provides just basic auth for access you should combine it with an HTTPS reverse proxy for public server. Here is a simple `proxy_pass` for nginx.

```
# /etc/nginx/sites-available/YOURHOST
server {
    server_name YOURHOST;

    location / {
        proxy_pass http://127.0.0.1:8080;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/YOURHOST/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/YOURHOST/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

```

## Setting Up Telegram Bot

First, you'll need to create a bot for Telegram. Just talk to [BotFather](https://telegram.me/botfather) and follow simple steps until it gives you a token for it.
You'll also need to create a Telegram group, the place where you and crypto-trading-bot will communicate. After creating it, add the bot as administrator (make sure to uncheck "All Members Are Admins").

### Retrieving Chat IDs

Invite `@RawDataBot` to your group and get your group id in the sent chat id field

```text
Message
 ├ message_id: 338
 ├ from
 ┊  ├ id: *****
 ┊  ├ is_bot: false
 ┊  ├ first_name: 사이드
 ┊  ├ username: ******
 ┊  └ language_code: en
 ├ chat
 ┊  ├ id: -1001118554477
 ┊  ├ title: Test Group
 ┊  └ type: supergroup
 ├ date: 1544948900
 └ text: A
```

Look for id: -1001118554477 is your chat id (with the negative sign).


## Related Links

### Trading Bots Inspiration

Other bots with possible design pattern

- https://github.com/DeviaVir/zenbot
- https://github.com/magic8bot/magic8bot
- https://github.com/askmike/gekko
- https://github.com/freqtrade/freqtrade
- https://github.com/Ekliptor/WolfBot
- https://github.com/andresilvasantos/bitprophet
- https://github.com/kavehs87/PHPTradingBot
- https://github.com/Superalgos/Superalgos

### Strategies

Some strategies based on technical indicators for collecting some ideas

- https://github.com/freqtrade/freqtrade-strategies
- https://github.com/freqtrade/freqtrade-strategies/tree/master/user_data/strategies/berlinguyinca
- https://github.com/xFFFFF/Gekko-Strategies
- https://github.com/sthewissen/Mynt/tree/master/src/Mynt.Core/Strategies
- https://github.com/Ekliptor/WolfBot/tree/master/src/Strategies
- https://github.com/Superalgos/Strategy-BTC-WeakHandsBuster
- https://github.com/Superalgos/Strategy-BTC-BB-Top-Bounce
