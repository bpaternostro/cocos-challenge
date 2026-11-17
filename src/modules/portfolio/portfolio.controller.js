import { asyncHandler } from '../../utils/asyncHandler.js';
import { PortfolioService } from './portfolio.service.js';

export class PortfolioController {
  static getPortfolio = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const portfolio = await PortfolioService.getPortfolioByUserId(userId);
    res.status(200).json(portfolio);
  });
}
