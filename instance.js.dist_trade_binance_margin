var c = module.exports = {}

c.symbols = []

const InstanceUtil = require('./src/utils/instance_util');

c.init = async () => {

    // Binance all BTC margin pairs
    //c.symbols.push(...(await InstanceUtil.binanceInitMarginBTC()));

    c.symbols.push(
      ...(await InstanceUtil.binanceInitMarginBTC(pair => {
        pair.trade = {
          'currency_capital': 0.00055,
          'strategies': [
            {
              'strategy': 'obv_pump_dump'
            },
            {
              'strategy': 'cci',
              'interval': '15m',
              'options': {
                'period': '15m'
              }
            },
            {
              'strategy': 'macd',
              'interval': '60m',
              'options': {
                'period': '1h'
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
      }))
    );

    // Binance all BUSD margin pairs
    //c.symbols.push(...(await InstanceUtil.binanceInitMarginBusd()));

    c.symbols.push(
      ...(await InstanceUtil.binanceInitMarginBusd(pair => {

        if (['BTCBUSD','ETHBUSD'].includes(pair.symbol)) {
        pair.trade = {
          'currency_capital': 12,
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
                'amount_currency': '24',
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

        if (!['BTCBUSD','ETHBUSD'].includes(pair.symbol)) {
        pair.trade = {
          'currency_capital': 12,
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

    // Binance all ETH margin pairs
    //c.symbols.push(...(await InstanceUtil.binanceInitMarginETH()));

    c.symbols.push(
      ...(await InstanceUtil.binanceInitMarginETH(pair => {
        pair.trade = {
          'currency_capital': 0.0069,
          'strategies': [
            {
              'strategy': 'obv_pump_dump'
            },
            {
              'strategy': 'cci',
              'interval': '15m',
              'options': {
                'period': '15m'
              }
            },
            {
              'strategy': 'macd',
              'interval': '60m',
              'options': {
                'period': '1h'
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
      }))
    );

    // Binance all USDT margin pairs
    //c.symbols.push(...(await InstanceUtil.binanceInitMarginUsdT()));

    c.symbols.push(
      ...(await InstanceUtil.binanceInitMarginUsdT(pair => {

        if (['BTCUSDT','ETHUSDT'].includes(pair.symbol)) {
        pair.trade = {
          'currency_capital': 12,
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
                'amount_currency': '24',
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

        if (!['BTCUSDT','ETHUSDT'].includes(pair.symbol)) {
        pair.trade = {
          'currency_capital': 12,
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

// Binance Margin

// USDC
let margusdc = [
  //  'BTCUSDC',
//    'EOSUSDC',
  //  'ETHUSDC'
//    'LTCUSDC',
//    'XRPUSDC'
]

margusdc.forEach((pair) => {
    c.symbols.push({
        'symbol': pair,
        'exchange': 'binance_margin',
        'periods': ['1m', '15m', '1h'],
        'state': 'watch',
        'trade': {
          'currency_capital': 12,
          'strategies': [
/*            {
              'strategy': 'obv_pump_dump'
            },
            {
              'strategy': 'cci',
              'interval': '15m',
              'options': {
                'period': '15m'
              }
            },
            {
              'strategy': 'macd',
              'interval': '15m',
              'options': {
                'period': '15m'
               }
            },
*/            {
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
                'amount_currency': '24',
                'percent_below_price': 0.1,
                'hma_period': 9,
                'hma_source': 'close'
              }
            }
          ]
        },
        'watchdogs': [
          {
            'name': 'stoploss_watch',
            'stop': 1.2
          }
        ]
    })
})

// BUSD
let margbusd = [
//    'ADABUSD',
//    'AGLDBUSD',
//    'ALGOBUSD',
//    'ALICEBUSD',
  //  'ANCBUSD',
//    'ANKRBUSD',
//    'APEBUSD',
  //  'ASTRBUSD',
//    'ATOMBUSD',
//    'AUDIOBUSD',
//    'AVAXBUSD',
//    'AXSBUSD',
//    'BAKEBUSD',
//    'BATBUSD',
//    'BCHBUSD',
//    'BICOBUSD',
  //  'BNBBUSD',
//    'BNXBUSD',
//    'BTCBUSD',
  //  'BURGERBUSD',
//    'C98BUSD',
//    'CAKEBUSD',
  //  'CELOBUSD',
//    'CHESSBUSD',
//    'CHRBUSD',
//    'CLVBUSD',
//    'COMPBUSD',
//    'COTIBSD',
//    'CRVBUSD',
//    'CTXCBUSD',
//    'DARBUSD',
//    'DASHBUSD',
//    'DOGEBUSD',
//    'DOTBUSD',
  //  'DYDXBUSD',
//    'EGLDBUSD',
//    'ENJBUSD',
//    'ENSBUSD',
//    'EOSBUSD',
//    'ETCBUSDD',
//    'ETHBUSD',
//    'FETBUSD',
  //  'FIDABUSD',
//    'FILBUSD',
//    'FLOWBUSD',
  //  'FLUXBUSD',
  //  'FRONTBUSD',
//    'FTMBUSD',
  //  'FTTBUSD',
  //  'GALBUSD',
//    'GALABUSD',
  //  'GMTBUSD',
//    'GTCBUSD',
//    'HBARBUSD',
//    'HIVEBUSD',
  //  'HNTBUSD',
  //  'HOTBUSD',
//    'ICPBUSD',
  //  'ICXBUSD',
//    'IDEXBUSD',
//    'IOTXBUSD',
//    'JASMYBUSD',
//    'KAVABUSD',
  //  'KDABUSD',
  //  'KLAYBUSD',
//    'KSMBUSD',
  //  'LDOBUSD',
  //  'LEVERBUSD',
//    'LINABUSD',
//    'LINKBUSD',
//    'LPTBUSDD',
//    'LRCBUSD',
//    'LTCBUSD',
//    'MANABUSD',
//    'MATICBUSD',
  //  'MBLBUSD',
//    'MBOXBUSD',
//    'MDTBUSD',
//    'MINABUSD',
  //  'MOBBUSD',
//    'MTLBUSD',
//    'NEARBUSD',
//    'NEOBUSD',
  //  'NEXOBUSD',
//    'OGNBUSD',
//    'ONEBUSD',
//    'ONTBUSD',
  //  'OPBUSD',
  //  'PAXGBUSD',
//    'PEOPLEBUSD',
//    'POLSBUSD',
//    'PONDBUSD',
//    'PYRBUSD',
//    'QNTBUSD',
//    'QUICKBUSD',
  //  'RAREBUSD',
  //  'REEFBUSD',
  //  'REIBUSD',
//    'RNDRBUSD',
//    'ROSEBUSD',
//    'RUNEBUSDD',
//    'SANDBUSD',
//    'SFFPBUSD',
//    'SHIBBUSD',
//    'SLPBUSD',
//    'SOLBUSD',
//    'STPTBUSD',
//    'STXBUSD',
  //  'SUNBUSD',
//    'SUPERBUSD',
//    'TLMBUSD',
  //  'TRIBEBUSD',
//    'TRXBUSD',
//    'TVKBUSD',
//    'UNIBUSD',
    //'USDCBUSD',
//    'VETBUSD',
  //  'VOXELBUSD',
//    'WAXPBUSD',
  //  'WINBUSD',
//    'XLMBUSD',
//    'XMRBUSD',
//    'XRPBUSD',
//    'XTZBUSD',
  //  'YGGBUSD'
//    'ZILBUSD'
]

margbusd.forEach((pair) => {
    c.symbols.push({
        'symbol': pair,
        'exchange': 'binance_margin',
        'periods': ['1m', '15m', '1h'],
        'state': 'watch',
        'trade': {
          'currency_capital': 12,
          'strategies': [
/*            {
              'strategy': 'obv_pump_dump'
            },
            {
              'strategy': 'cci',
              'interval': '15m',
              'options': {
                'period': '15m'
              }
            },
            {
              'strategy': 'macd',
              'interval': '15m',
              'options': {
                'period': '15m'
               }
            },
*/            {
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
/*            },
            {
              'strategy': 'dca_dipper',
              'interval': '15m',
              'options': {
                'period': '15m',
                'amount_currency': '24',
                'percent_below_price': 0.1,
                'hma_period': 9,
                'hma_source': 'close'
              }
*/            }
          ]
        },
        'watchdogs': [
          {
            'name': 'stoploss_watch',
            'stop': 1.2
          }
        ]
    })
})

// USDT
let margusdt = [
//    '1INCHUSDT',
//    'AAVEUSDT',
//    'ADAUSDT',
//    'AGLDUSDT',
//    'ALGOUSDT',
//    'ALICEUSDT',
    //'ANCUSDT',
//    'ANKRUSDT',
//    'ANTUSDT',
//    'APEUSDT',
  //  'API3USDT',
  //  'ARUSDT',
    //'ASTRUSDT',
//    'ATOMUSDT',
//    'AUDIOUSDT',
//    'AVAXUSDT',
//    'AXSUSDT',
//    'BAKEUSDT',
//    'BATUSDT',
//    'BCHUSDT',
  //  'BETAUSDT',
//    'BICOUSDT',
//    'BLZUSDT',
//    'BNBUSDT',
//    'BNXUSDT',
//    'BTCUSDT',
    //'BURGERUSDT',
    //'BUSDUSDT',
//    'C98USDT',
//    'CAKEUSDT',
    //'CELOUSDT',
//    'CHESSUSDT',
//    'CHRUSDT',
//    'CHZUSDT',
//    'CLVUSDT',
//    'COMPUSDT',
//    'COTIUSDT',
//    'CRVUSDT',
  //  'CTKUSDT',
//    'CTXCUSDT',
  //  'CVCUSDT',
//    'DARUSDT',
//    'DASHUSDT',
  //  'DENTUSDT',
//    'DOGEUSDT',
//    'DOTUSDT',
//    'DUSKUSDT',
    //'DYDXUSDT',
//    'EGLDUSDT',
//    'ENJUSDT',
//    'ENSUSDT',
//    'EOSUSDT',
//    'ETCUSDT',
//    'ETHUSDT',
//    'FETUSDT',
    //'FIDAUSDT',
//    'FILUSDT',
  //  'FLMUSDT',
//    'FLOWUSDT',
    //'FLUXUSDT',
//    'FTMUSDT',
    //'FTTUSDT',
    //'GALUSDT',
//    'GALAUSDT',
    //'GMTUSDT',
//    'GRTUSDT',
//    'GTCUSDT',
//    'HBARUSDT',
//    'HIVEUSDT',
    //'HNTUSDT',
    //'HOTUSDT',
//    'ICPUSDT',
    //'ICXUSDT',
//    'IDEXUSDT',
//    'IOSTUSDT',
//    'IOTAUSDT',
//    'IOTXUSDT',
//    'JASMYUSDT',
//    'KAVAUSDT',
    //'KDAUSDT',
  //  'KEYUSDT',
    //'KLAYUSDT',
  //  'KMDUSDT',
//    'KNCUSDT',
//    'KSMUSDT',
    //'LDOUSDT',
    //'LEVERUSDT',
//    'LINAUSDT',
//    'LINKUSDT',
//    'LPTUSDT',
//    'LRCUSDT',
//    'LTCUSDT',
//    'MANAUSDT',
//    'MATICUSDT',
    //'MBLUSDT',
//    'MBOXUSDT',
//    'MDTUSDT',
//    'MINAUSDT',
    //'MOBUSDT',
//    'MTLUSDT',
//    'NEARUSDT',
//    'NEOUSDT',
    //'NEXOUSDT',
//    'OGNUSDT',
//    'OMGUSDT',
//    'ONEUSDT',
//    'ONTUSDT',
    //'OPUSDT',
    //'PAXGUSDT',
//    'PEOPLEUSDT',
//    'POLSUSDT',
//    'PONDUSDT',
//    'PYRUSDT',
  //  'QIUSDT',
//    'QNTUSDT',
//    'QTUMUSDT',
//    'QUICKUSDT',
  //  'RADUSDT',
    //'RAREUSDT',
//    'REEFUSDT',
    //'REIUSDT',
//    'RNDRUSDT',
//    'ROSEUSDT',
//    'RUNEUSDT',
//    'RVNUSDT',
//    'SANDUSDT',
//    'SFPUSDT',
//    'SHIBUSDT',
//    'SKLUSDT',
//    'SLPUSDT',
//    'SNXUSDT',
//    'SOLUSDT',
//    'SRMUSDT',
//    'STPTUSDT',
//    'STXUSDT',
    //'SUNUSDT',
//    'SUPERUSDT',
//    'SUSHIUSDT',
//    'SXPUSDT',
//    'TFUELUSDT',
//    'THETAUSDT',
//    'TLMUSDT',
//    'TRIBEUSDT',
//    'TRXUSDT',
//    'TVKUSDT',
  //  'TWTUSDT',
  //  'UNFIUSDT',
//    'UNIUSDT',
    //'USDCUSDT',
//    'VETUSDT',
    //'VOXELUSDT',
  //  'WANUSDT',
//    'WAVESUSDT,
//    'WAXPUSDT',
    //'WINUSDT',
  //  'WOOUSDT'
//    'XLMUSDT',
//    'XMRUSDT',
//    'XRPUSDT',
//    'XTZUSDT',
    //'YGGUSDT',
//    'ZECUSDT',
//    'ZILUSDT'
]

margusdt.forEach((pair) => {
    c.symbols.push({
        'symbol': pair,
        'exchange': 'binance_margin',
        'periods': ['1m', '15m', '1h'],
        'state': 'watch',
        'trade': {
          'currency_capital': 10,
          'strategies': [
/*            {
              'strategy': 'obv_pump_dump'
            },
            {
              'strategy': 'cci',
              'interval': '15m',
              'options': {
                'period': '15m'
              }
            },
            {
              'strategy': 'macd',
              'interval': '15m',
              'options': {
                'period': '15m'
               }
            },
*/            {
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
/*            },
            {
              'strategy': 'dca_dipper',
              'interval': '15m',
              'options': {
                'period': '15m',
                'amount_currency': '24',
                'percent_below_price': 0.1,
                'hma_period': 9,
                'hma_source': 'close'
              }
*/            }
          ]
        },
        'watchdogs': [
          {
            'name': 'stoploss_watch',
            'stop': 1.2
          }
        ]
    })
})

// BTC
let margbtc = [
/*    '1INCHBTC',
    'AAVEBTC',
    'ADABTC',
    'AGLDBTC',
    'ALGOBTC',
    'ALICEBTC',
    'ANKRBTC',
    'ANTBTC',
    'APEBTC',
    'ATOMBTC',
    'AUDIOBTC',
    'AVAXBTC',
    'AXSBTC',
    'BAKEBTC',
    //'BATBTC',
    'BCHBTC',
    'BICOBTC',
    'BLZBTC',
    'BNBBTC',
    'BNXBTC',
    'C98BTC',
    'CAKEBTC',
    'CHESSBTC',
    'CHRBTC',
    'CHZBTC',
    'CLVBTC',
    'COMPBTC',
    'COTIBTC',
    'CRVBTC',
    'CTXCBTC',
    'DARBTC',
    'DASHBTC',
    'DOGEBTC',
    'DOTBTC',
    'DUSKBTC',
    'EGLDBTC',
    'ENJBTC',
    'ENSBTC',
    'EOSBTC',
    'ETCBTC',
    'ETHBTC',
    'FETBTC',
    'FILBTC',
    'FLOWBTC',
    'FTMBTC',
    'GALABTC',
    'GRTBTC',
    'GTCBTC',
    'HBARBTC',
    'HIVEBTC',
    'ICPBTC',
    'IDEXBTC',
    'IOSTBTC',
    'IOTABTC',
    'IOTXBTC',
    'JASMYBTC',
    'KAVABTC',
    'KNCBTC',
    'KSMBTC',
    'LINABTC',
    'LINKBTC',
    'LPTBTC',
    'LRCBTC',
    'LTCBTC',
    'MANABTC',
    'MATICBTC',
    'MBOXBTC',
    'MDTBTC',
    'MINABTC',
    'MTLBTC',
    'NEARBTC',
    'NEOBTC',
    'OGNBTC',
    'OMGBTC',
    'ONEBTC',
    'ONTBTC',
    'PEOPLEBTC',
    'POLSBTC',
    'PONDBTC',
    'PYRBTC',
    'QNTBTC',
    'QTUMBTC',
    'QUICKBTC',
    //'REEFBTC',
    'RNDRBTC',
    'ROSEBTC',
    'RUNEBTC',
    'RVNBTC',
    'SANDBTC',
    'SFPBTC',
    'SKLBTC',
    'SNXBTC',
    'SOLBTC',
    'SRMBTC',
    'STPTBTC',
    'STXBTC',
    'SUPERBTC',
    'SUSHIBTC',
    'SXPBTC',
    'TFUELBTC',
    'THETABTC',
    'TLMBTC',
    //'TRIBEBTC',
    'TRXBTC',
    'TVKBTC',
    'UNIBTC',
    'VETBTC',
    'WAVESBTC',
    'WAXPBTC',
    'XLMBTC',
    'XMRBTC',
    'XRPBTC',
    'XTZBTC',
    'ZECBTC',
    'ZILBTC'
*/]

margbtc.forEach((pair) => {
    c.symbols.push({
        'symbol': pair,
        'exchange': 'binance_margin',
        'periods': ['1m', '15m', '1h'],
        'state': 'watch',
        'trade': {
          'currency_capital': 0.00012,
          'strategies': [
            {
              'strategy': 'obv_pump_dump'
            },
            {
              'strategy': 'cci',
              'interval': '15m',
              'options': {
                'period': '15m'
              }
            },
            {
              'strategy': 'macd',
              'interval': '60m',
              'options': {
                'period': '1h'
               }
/*            },
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
                'amount_currency': '0.00024',
                'percent_below_price': 0.1,
                'hma_period': 9,
                'hma_source': 'close'
              }
*/            }
          ]
        },
        'watchdogs': [
          {
            'name': 'stoploss_watch',
            'stop': 1.2
          }
        ]
    })
})

// ETH
let margeth = [
/*    'ADAETH',
    'APEETH',
    'BNBETH',
    'EOSETH',
    'GRTETH',
    'LINKETH',
    'LTCETH',
    'SLPETH',
    'TRXETH',
    'XMRETH',
    'XRPETH'
*/]

margeth.forEach((pair) => {
    c.symbols.push({
        'symbol': pair,
        'exchange': 'binance_margin',
        'periods': ['1m', '15m', '1h'],
        'state': 'watch',
        'trade': {
          'currency_capital': 0.0052,
          'strategies': [
            {
              'strategy': 'obv_pump_dump'
            },
            {
              'strategy': 'cci',
              'interval': '15m',
              'options': {
                'period': '15m'
              }
            },
            {
              'strategy': 'macd',
              'interval': '60m',
              'options': {
                'period': '1h'
               }
/*            },
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
                'amount_currency': '0.01',
                'percent_below_price': 0.1,
                'hma_period': 9,
                'hma_source': 'close'
              }
*/            }
          ]
        },
        'watchdogs': [
          {
            'name': 'stoploss_watch',
            'stop': 1.2
          }
        ]
    })
})

// DOGE
let margdoge = [
    'SHIBDOGE'
]

margdoge.forEach((pair) => {
    c.symbols.push({
        'symbol': pair,
        'exchange': 'binance_margin',
        'periods': ['1m', '15m', '1h'],
        'state': 'watch',
        'trade': {
          'currency_capital': 200,
          'strategies': [
            {
              'strategy': 'obv_pump_dump'
            },
            {
              'strategy': 'cci',
              'interval': '15m',
              'options': {
                'period': '15m'
              }
            },
            {
              'strategy': 'macd',
              'interval': '60m',
              'options': {
                'period': '1h'
               }
/*            },
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
                'amount_currency': '64',
                'percent_below_price': 0.1,
                'hma_period': 9,
                'hma_source': 'close'
              }
*/            }
          ]
        },
        'watchdogs': [
          {
            'name': 'stoploss_watch',
            'stop': 1.2
          }
        ]
    })
})
