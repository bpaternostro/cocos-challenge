import { DataTypes } from 'sequelize';

/**
 * @param {import('sequelize').Sequelize} sequelize
 */
export const defineInstrumentModel = (sequelize) =>
  sequelize.define(
    'Instrument',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ticker: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
    },
    {
      tableName: 'instruments',
      timestamps: false,
    },
  );
