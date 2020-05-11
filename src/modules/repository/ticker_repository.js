module.exports = function(sequelize, DataTypes) {
  const TickerRepository = sequelize.define(
    'Ticker',
    {
      exchange: {
        type: DataTypes.STRING(255),
        allowNull: true,
        primaryKey: true
      },
      symbol: {
        type: DataTypes.STRING(255),
        allowNull: true,
        primaryKey: true
      },
      ask: {
        type: DataTypes.REAL,
        allowNull: true
      },
      bid: {
        type: DataTypes.REAL,
        allowNull: true
      }
    },
    {
      tableName: 'tickers'
    }
  );

  TickerRepository.insertTickers = function(tickers) {
    return TickerRepository.bulkCreate(tickers, {
      updateOnDuplicate: ['ask', 'bid']
    });
  };

  return TickerRepository;
};
