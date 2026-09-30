import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const translateText = asyncHandler(async (req, res) => {
  const { text, targetLanguage } = req.body;
  return successResponse(res, {
    statusCode: 200,
    message: 'Translated successfully',
    data: { original: text, translated: text, language: targetLanguage }
  });
});
