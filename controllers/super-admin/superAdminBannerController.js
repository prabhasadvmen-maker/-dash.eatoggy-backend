import Banner from '../../models/promotions/Banner.js';
import { uploadToR2, getPresignedUrl } from '../../services/r2UploadService.js';

/**
 * POST /api/super-admin/banners
 * Create a new banner
 */
export const createBanner = async (req, res) => {
  try {
    const { title, description, badge, ctaText, ctaLink, displayOrder, isActive, startDate, endDate } = req.body;

    // Validation
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (!req.file && isActive === 'true') {
      return res.status(400).json({ success: false, message: 'Image is required for an active banner' });
    }

    // Date Validation
    let sDate = startDate ? new Date(startDate) : null;
    let eDate = endDate ? new Date(endDate) : null;

    if (sDate && eDate && eDate < sDate) {
      return res.status(400).json({ success: false, message: 'End date cannot be before start date' });
    }

    let imageUrl = '';
    if (req.file) {
      imageUrl = await uploadToR2(req.file, 'banners');
      if (!imageUrl) {
        return res.status(500).json({ success: false, message: 'Failed to upload image' });
      }
    }

    const newBanner = new Banner({
      title,
      description,
      badge,
      image: imageUrl,
      ctaText,
      ctaLink,
      displayOrder: displayOrder || 0,
      isActive: isActive === 'true' || isActive === true,
      startDate: sDate,
      endDate: eDate
    });

    await newBanner.save();

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: newBanner
    });
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * GET /api/super-admin/banners
 * Get all banners
 */
export const getBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ displayOrder: 1, createdAt: -1 });
    
    const bannersWithSignedUrls = await Promise.all(banners.map(async (banner) => {
      const bannerObj = banner.toObject();
      if (bannerObj.image) {
        bannerObj.image = await getPresignedUrl(bannerObj.image);
      }
      return bannerObj;
    }));

    res.status(200).json({
      success: true,
      data: bannersWithSignedUrls
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * GET /api/super-admin/banners/:id
 * Get single banner by ID
 */
export const getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    const bannerObj = banner.toObject();
    if (bannerObj.image) {
      bannerObj.image = await getPresignedUrl(bannerObj.image);
    }

    res.status(200).json({
      success: true,
      data: bannerObj
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    console.error('Error fetching banner:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * PUT /api/super-admin/banners/:id
 * Update an existing banner
 */
export const updateBanner = async (req, res) => {
  try {
    const { title, description, badge, ctaText, ctaLink, displayOrder, isActive, startDate, endDate } = req.body;

    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    if (title) banner.title = title;
    if (description !== undefined) banner.description = description;
    if (badge !== undefined) banner.badge = badge;
    if (ctaText !== undefined) banner.ctaText = ctaText;
    if (ctaLink !== undefined) banner.ctaLink = ctaLink;
    if (displayOrder !== undefined) banner.displayOrder = displayOrder;
    if (isActive !== undefined) banner.isActive = isActive === 'true' || isActive === true;

    // Dates
    if (startDate !== undefined) banner.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) banner.endDate = endDate ? new Date(endDate) : null;

    if (banner.startDate && banner.endDate && banner.endDate < banner.startDate) {
      return res.status(400).json({ success: false, message: 'End date cannot be before start date' });
    }

    // Require image if active
    if (banner.isActive && !banner.image && !req.file) {
      return res.status(400).json({ success: false, message: 'Image is required for an active banner' });
    }

    if (req.file) {
      const imageUrl = await uploadToR2(req.file, 'banners');
      if (!imageUrl) {
        return res.status(500).json({ success: false, message: 'Failed to upload image' });
      }
      banner.image = imageUrl;
    }

    await banner.save();

    res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      data: banner
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    console.error('Error updating banner:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * DELETE /api/super-admin/banners/:id
 * Delete a banner
 */
export const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    console.error('Error deleting banner:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * PATCH /api/super-admin/banners/:id/status
 * Toggle active status
 */
export const toggleBannerStatus = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    if (!banner.isActive && !banner.image) {
      return res.status(400).json({ success: false, message: 'Cannot activate banner without an image' });
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    res.status(200).json({
      success: true,
      message: `Banner ${banner.isActive ? 'activated' : 'deactivated'} successfully`,
      data: banner
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    console.error('Error toggling banner status:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
