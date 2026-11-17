import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { searchAssetsSchema } from './assets.schema.js';
import { AssetsController } from './assets.controller.js';

export const assetsRouter = Router();

assetsRouter.get('/', validate(searchAssetsSchema), AssetsController.searchAssets);
