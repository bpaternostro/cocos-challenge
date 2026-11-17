import { asyncHandler } from '../../utils/asyncHandler.js';
import { AssetsService } from './assets.service.js';

export class AssetsController {
  static searchAssets = asyncHandler(async (req, res) => {
    const result = await AssetsService.searchAssets(req.query);
    res.status(200).json(result);
  });
}
