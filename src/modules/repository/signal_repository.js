const { Op } = require('sequelize');

module.exports = function(sequelize, DataTypes) {
  const SignalRepository = sequelize.define(
    'Signal',
    {
      exchange: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      symbol: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      options: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      side: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      strategy: {
        type: DataTypes.STRING(50),
        allowNull: true
      }
    },
    {
      tableName: 'signals'
    }
  );

  SignalRepository.getSignals = async since => {
    return SignalRepository.findAll({
      where: { updatedAt: { [Op.gt]: since } },
      order: [['updatedAt', 'DESC']],
      limit: 1000
      // raw : true
    });
  };

  SignalRepository.insertSignal = async (exchange, symbol, options, side, strategy) =>
    SignalRepository.create({
      exchange: exchange,
      symbol: symbol,
      options: JSON.stringify(options || {}),
      side: side,
      strategy: strategy
    });

  return SignalRepository;
};
