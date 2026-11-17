import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import {
  createOrderSchema,
  cancelOrderSchema,
  updateOrderStatusSchema,
  listOrdersSchema,
} from './orders.schema.js';
import { OrdersController } from './orders.controller.js';

export const ordersRouter = Router();

ordersRouter.get('/', validate(listOrdersSchema), OrdersController.listOrders);
ordersRouter.post('/', validate(createOrderSchema), OrdersController.createOrder);
ordersRouter.patch('/:orderId/cancel', validate(cancelOrderSchema), OrdersController.cancelOrder);
ordersRouter.patch('/:orderId/status', validate(updateOrderStatusSchema), OrdersController.updateOrderStatus);
