import { DataTypes } from 'sequelize';

/**
 * @param {import('sequelize').Sequelize} sequelize
 */
export const defineOrderModel = (sequelize) =>
  sequelize.define(
    'Order',
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
      userId: {
        type: DataTypes.INTEGER,
        field: 'userid',
        allowNull: false,
      },
      size: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      side: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      datetime: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      idempotencyKey: {
        type: DataTypes.STRING(36),
        field: 'idempotencykey',
        allowNull: true,
      },
      idempotencyHash: {
        type: DataTypes.STRING(64),
        field: 'idempotencyhash',
        allowNull: true,
      },
    },
    {
      tableName: 'orders',
      timestamps: false,
    },
  );
