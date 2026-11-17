import { DataTypes } from 'sequelize';

/**
 * Materialized user position per instrument, updated atomically in order transactions.
 * @param {import('sequelize').Sequelize} sequelize
 */
export const definePositionModel = (sequelize) =>
  sequelize.define(
    'Position',
    {
      userId: {
        type: DataTypes.INTEGER,
        field: 'userid',
        primaryKey: true,
      },
      instrumentId: {
        type: DataTypes.INTEGER,
        field: 'instrumentid',
        primaryKey: true,
      },
      qty: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      },
      reservedQty: {
        type: DataTypes.DECIMAL(18, 2),
        field: 'reservedqty',
        allowNull: false,
        defaultValue: 0,
      },
      avgCost: {
        type: DataTypes.DECIMAL(18, 4),
        field: 'avgcost',
        allowNull: false,
        defaultValue: 0,
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updatedat',
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'positions',
      timestamps: false,
    },
  );
