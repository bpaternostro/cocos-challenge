import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { getPortfolioSchema } from './portfolio.schema.js';
import { PortfolioController } from './portfolio.controller.js';

export const portfolioRouter = Router();

portfolioRouter.get('/:userId', validate(getPortfolioSchema), PortfolioController.getPortfolio);
