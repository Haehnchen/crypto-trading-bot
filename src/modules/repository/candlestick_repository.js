const { Op } = require('sequelize');

module.exports = function(sequelize, DataTypes) {
  const CandlestickRepository = sequelize.define(
    'Candlestick',
    {
      exchange: {
        type: DataTypes.STRING(255),
        primaryKey: true
      },
      symbol: {
        type: DataTypes.STRING(255),
        primaryKey: true
      },
      period: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        validate: {
          isIn: [['m', 'h', 'd', 'y']]
        }
      },
      time: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        validate: {
          min: 631148400
        }
      },
      open: {
        type: DataTypes.REAL,
        allowNull: true
      },
      high: {
        type: DataTypes.REAL,
        allowNull: true
      },
      low: {
        type: DataTypes.REAL,
        allowNull: true
      },
      close: {
        type: DataTypes.REAL,
        allowNull: true
      },
      volume: {
        type: DataTypes.REAL,
        allowNull: true
      }
    },
    {
      tableName: 'candlesticks',
      timestamps: false
    }
  );

  CandlestickRepository.getLookbacksForPair = async (exchange, symbol, period, limit = 750) => {
    return CandlestickRepository.getCandlesInWindow(exchange, symbol, period, undefined, undefined, limit);
  };

  CandlestickRepository.getLookbacksSince = async (exchange, symbol, period, start) => {
    return CandlestickRepository.getCandlesInWindow(exchange, symbol, period, start);
  };

  CandlestickRepository.getCandlesInWindow = async (exchange, symbol, period, start, end, limit = 1000) => {
    const whereCondition = {
      exchange: exchange,
      symbol: symbol,
      period: period
    };
    const timeConditions = {
      ...(typeof(start) !== 'undefined') && {[Op.gt]: start},
      ...(typeof(end) !== 'undefined') && {[Op.lt]: end}
    };
    if (Object.keys(timeConditions).length !== 0) {
      whereCondition.time = timeConditions;
    };
    return CandlestickRepository.findAll({
      attributes: ['time', 'open', 'high', 'low', 'close', 'volume'],
      where: whereCondition,
      order: [['time', 'DESC']],
      limit: limit,
      raw : true
    });   
  };

  CandlestickRepository.getExchangePairs = async () => {
    return  CandlestickRepository.findAll({
      group: ['exchange', 'symbol'],
      attributes: ['exchange', 'symbol'],
      order: ['exchange', 'symbol'],
      raw : true
    });
  };

  CandlestickRepository.insertCandles = (exchangeCandlesticks) => {
    return CandlestickRepository.bulkCreate(exchangeCandlesticks, {
      updateOnDuplicate: ['open', 'high', 'low', 'close', 'volume']
    });
  };

  return CandlestickRepository;
};
