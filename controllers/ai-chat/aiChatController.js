import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const sendChatMessage = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Message sent successfully',
    data: { response: 'Hello, how can I help?', conversationId: 'conv123' }
  });
});

export const getChatHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Chat history retrieved successfully',
    data: [],
    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
  });
});
