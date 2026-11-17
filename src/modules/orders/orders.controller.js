import { asyncHandler } from '../../utils/asyncHandler.js';
import { OrdersService } from './orders.service.js';

export class OrdersController {
  static listOrders = asyncHandler(async (req, res) => {
    const result = await OrdersService.listOrders(req.query);
    res.status(200).json(result);
  });

  static createOrder = asyncHandler(async (req, res) => {
    const idempotencyKey = req.headers['idempotency-key'];
    const { order, isDuplicate } = await OrdersService.createOrder(req.body, idempotencyKey);
    res.status(isDuplicate ? 200 : 201).json(order);
  });

  static cancelOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrdersService.cancelOrder(orderId);
    res.status(200).json(order);
  });

  static updateOrderStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;
    const order = await OrdersService.updateOrderStatus(orderId, status);
    res.status(200).json(order);
  });
}
