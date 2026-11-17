import { sequelize } from '../../config/database.js';
import { defineUserModel } from './user.model.js';
import { defineInstrumentModel } from './instrument.model.js';
import { defineOrderModel } from './order.model.js';
import { defineMarketDataModel } from './marketdata.model.js';
import { definePositionModel } from './position.model.js';

export const User = defineUserModel(sequelize);
export const Instrument = defineInstrumentModel(sequelize);
export const Order = defineOrderModel(sequelize);
export const MarketData = defineMarketDataModel(sequelize);
export const Position = definePositionModel(sequelize);

User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Instrument.hasMany(Order, { foreignKey: 'instrumentId', as: 'orders' });
Order.belongsTo(Instrument, { foreignKey: 'instrumentId', as: 'instrument' });

Instrument.hasMany(MarketData, { foreignKey: 'instrumentId', as: 'marketData' });
MarketData.belongsTo(Instrument, { foreignKey: 'instrumentId', as: 'instrument' });

User.hasMany(Position, { foreignKey: 'userId', as: 'positions' });
Position.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Instrument.hasMany(Position, { foreignKey: 'instrumentId', as: 'positions' });
Position.belongsTo(Instrument, { foreignKey: 'instrumentId', as: 'instrument' });

export { sequelize };
