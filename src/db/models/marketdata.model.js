import { DataTypes } from 'sequelize';

/**
 * @param {import('sequelize').Sequelize} sequelize
 */
export const defineMarketDataModel = (sequelize) =>
  sequelize.define(
    'MarketData',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      instrumentId: {
        type: DataTypes.INTEGER,
        field: 'instrumentid',
        allowNull: false,
      },
      high: {
        type: DataTypes.DECIMAL(10, 2),
      },
      low: {
        type: DataTypes.DECIMAL(10, 2),
      },
      open: {
        type: DataTypes.DECIMAL(10, 2),
      },
      close: {
        type: DataTypes.DECIMAL(10, 2),
      },
      previousClose: {
        type: DataTypes.DECIMAL(10, 2),
        field: 'previousclose',
      },
      date: {
        type: DataTypes.DATEONLY,
      },
    },
    {
      tableName: 'marketdata',
      timestamps: false,
    },
  );
