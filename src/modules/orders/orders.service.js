import crypto from 'node:crypto';
import Decimal from 'decimal.js';
import { sequelize } from '../../db/models/index.js';
import { AppError } from '../../utils/AppError.js';
import { OrdersRepository } from './orders.repository.js';
import { calculateOrderSizeFromAmount, calculateWeightedAvgCost } from './orders.calculator.js';

const MAX_ORDER_TOTAL = new Decimal('99999999999999.99');

const computePayloadHash = (payload) =>
  crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

export class OrdersService {
  /**
   * Lists paginated orders for a user.
   * @param {{ userId: number, status?: string, side?: string, limit: number, offset: number }} params
   */
  static async listOrders(params) {
    const user = await OrdersRepository.findUserById(params.userId);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const { rows, total } = await OrdersRepository.findOrdersByUserId(params);

    const data = rows.map(({ totalCount: _totalCount, ...order }) => ({
      ...order,
      price: Number(new Decimal(order.price).toFixed(2)),
    }));

    return {
      data,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
      },
    };
  }

  /**
   * Creates a MARKET, LIMIT, CASH_IN, or CASH_OUT order inside an ACID transaction.
   * @param {object} payload
   * @param {string | undefined} idempotencyKey
   * @returns {Promise<{ order: object, isDuplicate: boolean }>}
   */
  static async createOrder(payload, idempotencyKey) {
    const { userId, instrumentId, side, type, size: inputSize, amount, price: inputPrice } = payload;
    const payloadHash = idempotencyKey ? computePayloadHash(payload) : null;

    return sequelize.transaction(async (transaction) => {
      const user = await OrdersRepository.lockUserById(userId, transaction);
      if (!user) {
        throw new AppError(404, 'User not found');
      }

      if (idempotencyKey) {
        const existingOrder = await OrdersRepository.findByIdempotencyKey(
          userId,
          idempotencyKey,
          transaction,
        );
        if (existingOrder) {
          if (existingOrder.idempotencyHash && existingOrder.idempotencyHash !== payloadHash) {
            throw new AppError(422, 'Idempotency-Key already used with a different payload');
          }
          return { order: existingOrder.toJSON(), isDuplicate: true };
        }
      }

      const instrument = await OrdersRepository.findInstrumentById(instrumentId, transaction);
      if (!instrument) {
        throw new AppError(404, 'Instrument not found');
      }

      const isCashTransfer = side === 'CASH_IN' || side === 'CASH_OUT';
      if (isCashTransfer && instrument.type !== 'MONEDA') {
        throw new AppError(400, 'CASH_IN and CASH_OUT orders must target a MONEDA instrument');
      }
      if (!isCashTransfer && instrument.type === 'MONEDA') {
        throw new AppError(400, 'BUY and SELL orders cannot target a MONEDA instrument');
      }

      let executionPrice;
      if (isCashTransfer) {
        executionPrice = new Decimal(1);
      } else if (type === 'MARKET') {
        const latestClose = await OrdersRepository.findLatestMarketPrice(instrumentId, transaction);
        if (latestClose === null) {
          throw new AppError(422, 'No market data available for this instrument');
        }
        executionPrice = new Decimal(latestClose);
      } else {
        executionPrice = new Decimal(inputPrice);
      }

      const size = inputSize !== undefined
        ? inputSize
        : calculateOrderSizeFromAmount(amount, executionPrice.toString());

      if (size < 1) {
        throw new AppError(400, 'Amount is insufficient to operate at least 1 unit');
      }

      const orderTotal = new Decimal(size).times(executionPrice);
      if (orderTotal.gt(MAX_ORDER_TOTAL)) {
        throw new AppError(400, 'Order total exceeds maximum supported amount');
      }

      const arsInstrument = instrument.type === 'MONEDA'
        ? instrument
        : await OrdersRepository.findArsInstrument(transaction);

      if (!arsInstrument) {
        throw new AppError(500, 'Base MONEDA instrument not configured');
      }

      const arsPos = await OrdersRepository.lockOrCreatePosition(userId, arsInstrument.id, transaction);
      const assetPos = instrument.id === arsInstrument.id
        ? arsPos
        : await OrdersRepository.lockOrCreatePosition(userId, instrument.id, transaction);

      const availableCash = new Decimal(arsPos.qty).minus(arsPos.reservedQty);
      const availableShares = new Decimal(assetPos.qty).minus(assetPos.reservedQty);

      const hasSufficientFunds = (() => {
        if (side === 'CASH_IN') return true;
        if (side === 'CASH_OUT') return availableCash.gte(size);
        if (side === 'BUY') return availableCash.gte(orderTotal);
        if (side === 'SELL') return availableShares.gte(size);
        return false;
      })();

      if (!hasSufficientFunds) {
        const rejectedOrder = await OrdersRepository.createOrder(
          {
            userId,
            instrumentId,
            side,
            type,
            size,
            price: executionPrice.toFixed(2),
            status: 'REJECTED',
            datetime: new Date(),
            idempotencyKey: idempotencyKey ?? null,
            idempotencyHash: payloadHash,
          },
          transaction,
        );
        return { order: rejectedOrder.toJSON(), isDuplicate: false };
      }

      let finalStatus;
      if (type === 'MARKET') {
        finalStatus = 'FILLED';
        if (side === 'CASH_IN') {
          arsPos.qty = new Decimal(arsPos.qty).plus(size).toFixed(2);
        } else if (side === 'CASH_OUT') {
          arsPos.qty = new Decimal(arsPos.qty).minus(size).toFixed(2);
        } else if (side === 'BUY') {
          arsPos.qty = new Decimal(arsPos.qty).minus(orderTotal).toFixed(2);
          const newAvg = calculateWeightedAvgCost(
            assetPos.qty,
            assetPos.avgCost,
            size,
            executionPrice.toString(),
          );
          assetPos.qty = new Decimal(assetPos.qty).plus(size).toFixed(2);
          assetPos.avgCost = newAvg.toFixed(4);
        } else if (side === 'SELL') {
          arsPos.qty = new Decimal(arsPos.qty).plus(orderTotal).toFixed(2);
          const nextQty = new Decimal(assetPos.qty).minus(size);
          assetPos.qty = nextQty.toFixed(2);
          if (nextQty.lte(0)) {
            assetPos.avgCost = '0.0000';
          }
        }
      } else {
        finalStatus = 'NEW';
        if (side === 'BUY') {
          arsPos.reservedQty = new Decimal(arsPos.reservedQty).plus(orderTotal).toFixed(2);
        } else if (side === 'SELL') {
          assetPos.reservedQty = new Decimal(assetPos.reservedQty).plus(size).toFixed(2);
        }
      }

      await OrdersRepository.updatePosition(arsPos, transaction);
      if (assetPos !== arsPos) {
        await OrdersRepository.updatePosition(assetPos, transaction);
      }

      const createdOrder = await OrdersRepository.createOrder(
        {
          userId,
          instrumentId,
          side,
          type,
          size,
          price: executionPrice.toFixed(2),
          status: finalStatus,
          datetime: new Date(),
          idempotencyKey: idempotencyKey ?? null,
          idempotencyHash: payloadHash,
        },
        transaction,
      );

      return { order: createdOrder.toJSON(), isDuplicate: false };
    });
  }

  /**
   * Transitions a NEW order to FILLED, CANCELLED, or REJECTED atomically.
   * @param {number} orderId
   * @param {'FILLED' | 'CANCELLED' | 'REJECTED'} targetStatus
   */
  static async updateOrderStatus(orderId, targetStatus) {
    return sequelize.transaction(async (transaction) => {
      const existingOrder = await OrdersRepository.findOrderById(orderId, transaction);
      if (!existingOrder) {
        throw new AppError(404, 'Order not found');
      }

      await OrdersRepository.lockUserById(existingOrder.userId, transaction);
      const order = await OrdersRepository.findOrderById(orderId, transaction);

      if (order.status !== 'NEW') {
        throw new AppError(
          409,
          `Only NEW orders can transition to ${targetStatus} (current status: ${order.status})`,
        );
      }

      const arsInstrument = await OrdersRepository.findArsInstrument(transaction);
      if (!arsInstrument) {
        throw new AppError(500, 'Base MONEDA instrument not configured');
      }

      const arsPos = await OrdersRepository.lockOrCreatePosition(
        order.userId,
        arsInstrument.id,
        transaction,
      );
      const assetPos = order.instrumentId === arsInstrument.id
        ? arsPos
        : await OrdersRepository.lockOrCreatePosition(order.userId, order.instrumentId, transaction);

      const orderTotal = new Decimal(order.size).times(order.price);

      // Release reservation held while order was NEW
      if (order.side === 'BUY') {
        arsPos.reservedQty = Decimal.max(
          0,
          new Decimal(arsPos.reservedQty).minus(orderTotal),
        ).toFixed(2);
      } else if (order.side === 'SELL') {
        assetPos.reservedQty = Decimal.max(
          0,
          new Decimal(assetPos.reservedQty).minus(order.size),
        ).toFixed(2);
      }

      // If executed (FILLED), settle cash and shares
      if (targetStatus === 'FILLED') {
        if (order.side === 'BUY') {
          arsPos.qty = new Decimal(arsPos.qty).minus(orderTotal).toFixed(2);
          const newAvg = calculateWeightedAvgCost(
            assetPos.qty,
            assetPos.avgCost,
            order.size,
            order.price,
          );
          assetPos.qty = new Decimal(assetPos.qty).plus(order.size).toFixed(2);
          assetPos.avgCost = newAvg.toFixed(4);
        } else if (order.side === 'SELL') {
          arsPos.qty = new Decimal(arsPos.qty).plus(orderTotal).toFixed(2);
          const nextQty = new Decimal(assetPos.qty).minus(order.size);
          assetPos.qty = nextQty.toFixed(2);
          if (nextQty.lte(0)) {
            assetPos.avgCost = '0.0000';
          }
        }
      }

      await OrdersRepository.updatePosition(arsPos, transaction);
      if (assetPos !== arsPos) {
        await OrdersRepository.updatePosition(assetPos, transaction);
      }

      order.status = targetStatus;
      await order.save({ transaction });

      return order.toJSON();
    });
  }

  /**
   * Cancels a NEW order and releases its reserved cash/shares atomically.
   * @param {number} orderId
   */
  static async cancelOrder(orderId) {
    return OrdersService.updateOrderStatus(orderId, 'CANCELLED');
  }
}
