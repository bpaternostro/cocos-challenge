import { DataTypes } from 'sequelize';

/**
 * @param {import('sequelize').Sequelize} sequelize
 */
export const defineUserModel = (sequelize) =>
  sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      accountNumber: {
        type: DataTypes.STRING(20),
        field: 'accountnumber',
        allowNull: false,
      },
    },
    {
      tableName: 'users',
      timestamps: false,
    },
  );
