var c = module.exports = {}

c.symbols = []

const InstanceUtil = require('./src/utils/instance_util');

c.init = async () => {

    c.symbols.push(
      ...(await InstanceUtil.binanceFuturesInit(pair => {

        if (['AVAXUSDT','BTCBUSD','BTCUSDT'].includes(pair.symbol)) {
        pair.trade = {
          'currency_capital': 25,
          'strategies': [
            {
              'strategy': 'dip_catcher',
              'interval': '15m',
              'options': {
                'period': '15m',
                'trend_cloud_multiplier': 4,
                'hma_high_period': 9,
                'hma_high_candle_source': 'close',
                'hma_low_period': 9,
                'hma_low_candle_source': 'close'
              }
            },
            {
              'strategy': 'dca_dipper',
              'interval': '15m',
              'options': {
                'period': '15m',
                'amount_currency': '50',
                'percent_below_price': 0.1,
                'hma_period': 9,
                'hma_source': 'close'
              }
            }
          ]
        };
        pair.watchdogs = [
          {
            'name': 'stoploss_watch',
            'stop': 1.2
          }
        ];
        return pair;
	}

        if (['SOLBUSD','SOLUSDT'].includes(pair.symbol)) {
        pair.trade = {
          'currency_capital': 50,
          'strategies': [
            {
              'strategy': 'dip_catcher',
              'interval': '15m',
              'options': {
                'period': '15m',
                'trend_cloud_multiplier': 4,
                'hma_high_period': 9,
                'hma_high_candle_source': 'close',
                'hma_low_period': 9,
                'hma_low_candle_source': 'close'
              }
            },
            {
              'strategy': 'dca_dipper',
              'interval': '15m',
              'options': {
                'period': '15m',
                'amount_currency': '100',
                'percent_below_price': 0.1,
                'hma_period': 9,
                'hma_source': 'close'
              }
            }
          ]
        };
        pair.watchdogs = [
          {
            'name': 'stoploss_watch',
            'stop': 1.2
          }
        ];
        return pair;
	}

        if (['AXSUSDT','BNXUSDT',].includes(pair.symbol)) {
        pair.trade = {
          'currency_capital': 20,
          'strategies': [
            {
              'strategy': 'dip_catcher',
              'interval': '15m',
              'options': {
                'period': '15m',
                'trend_cloud_multiplier': 4,
                'hma_high_period': 9,
                'hma_high_candle_source': 'close',
                'hma_low_period': 9,
                'hma_low_candle_source': 'close'
              }
            },
            {
              'strategy': 'dca_dipper',
              'interval': '15m',
              'options': {
                'period': '15m',
                'amount_currency': '40',
                'percent_below_price': 0.1,
                'hma_period': 9,
                'hma_source': 'close'
              }
            }
          ]
        };
        pair.watchdogs = [
          {
            'name': 'stoploss_watch',
            'stop': 1.2
          }
        ];
        return pair;
	}

        if (!['AXSUSDT','AVAXUSDT','BNXUSDT','BTCBUSD','BTCUSDT','SOLBUSD','SOLUSDT'].includes(pair.symbol)) {
        pair.trade = {
          'currency_capital': 10,
          'strategies': [
            {
              'strategy': 'dip_catcher',
              'interval': '15m',
              'options': {
                'period': '15m',
                'trend_cloud_multiplier': 4,
                'hma_high_period': 9,
                'hma_high_candle_source': 'close',
                'hma_low_period': 9,
                'hma_low_candle_source': 'close'
              }
            },
            {
              'strategy': 'dca_dipper',
              'interval': '15m',
              'options': {
                'period': '15m',
                'amount_currency': '12',
                'percent_below_price': 0.1,
                'hma_period': 9,
                'hma_source': 'close'
              }
            }
          ]
        };
        pair.watchdogs = [
          {
            'name': 'stoploss_watch',
            'stop': 1.2
          }
        ];
        return pair;
	}

	return undefined;

      }))
    );

};
