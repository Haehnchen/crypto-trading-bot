var c = module.exports = {}

c.symbols = []

const InstanceUtil = require('./src/utils/instance_util');

c.init = async () => {

    // Binance futures USD PERP
    //c.symbols.push(...(await InstanceUtil.binanceFuturesCoin()));

    c.symbols.push(
      ...(await InstanceUtil.binanceFuturesCoin(pair => {

	if (['AAVEUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['ADAUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['ALGOUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['APEUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['ATOMUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['AVAXUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['AXSUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['BCHUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['BNBUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['BTCUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['CHZUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['DOGEUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['DOTUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['EGLDUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['ENSUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['EOSUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['ETCUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['ETHUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['FILUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['FTMUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['GALAUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['GMTUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['ICXUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['KNCUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['LINKUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['LTCUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['MANAUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['MATICUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['NEARUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['OPUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['ROSEUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['RUNEUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['SANDUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['SOLUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['THETAUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['TRXUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['UNIUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['VETUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['XLMUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['XMRUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['XRPUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['XTZUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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

	if (['ZILUSD_PERP'].includes(pair.symbol)) {
        pair.trade = {
	  'currency_capital': 1,
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
