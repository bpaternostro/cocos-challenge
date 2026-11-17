import { BASE_CURRENCY } from '../../config/constants.js';
import { AppError } from '../../utils/AppError.js';
import { PortfolioRepository } from './portfolio.repository.js';
import { calculatePortfolioSummary } from './portfolio.calculator.js';

export class PortfolioService {
  /**
   * @param {number} userId
   */
  static async getPortfolioByUserId(userId) {
    const user = await PortfolioRepository.findUserById(userId);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const rows = await PortfolioRepository.findPositionsWithLatestMarketData(userId);
    const summary = calculatePortfolioSummary(rows);

    return {
      userId: user.id,
      accountNumber: user.accountNumber,
      currency: BASE_CURRENCY,
      ...summary,
    };
  }
}
