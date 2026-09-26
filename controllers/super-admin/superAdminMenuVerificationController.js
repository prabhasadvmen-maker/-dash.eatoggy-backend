import MenuItem from '../../models/menu/MenuItem.js';
import { getPresignedUrl } from '../../integrations/storage/r2UploadService.js';

// @desc    Get pending menu items for verification
export const getPendingMenuItems = async (req, res) => {
  try {
    const { status, restaurantId } = req.query;
    
    const query = {};
    if (status && status !== 'ALL') {
      query.status = status;
    } else if (!status) {
      query.status = 'PENDING_REVIEW';
    }
    
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }

    const items = await MenuItem.find(query)
      .populate('restaurantId', 'restaurantName email mobile')
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name')
      .sort({ submittedAt: 1 });

    const itemsWithUrls = await Promise.all(items.map(async (item) => {
      const obj = item.toObject();
      if (obj.image) {
        obj.image = await getPresignedUrl(obj.image);
      }
      return obj;
    }));

    res.json({ data: itemsWithUrls });
  } catch (error) {
    console.error('Error fetching pending menu items:', error);
    res.status(500).json({ message: 'Failed to fetch pending menu items' });
  }
};

// @desc    Get detailed info of a menu item for verification
export const getMenuItemDetails = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id)
      .populate('restaurantId', 'restaurantName email mobile')
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name');

    if (!item) {
      return res.status(404).json({ message: 'Menu Item not found' });
    }

    const itemObj = item.toObject();
    if (itemObj.image) {
      itemObj.image = await getPresignedUrl(itemObj.image);
    }

    res.json({ data: itemObj });
  } catch (error) {
    if (error.kind === 'ObjectId') return res.status(404).json({ message: 'Menu Item not found' });
    console.error('Error fetching menu item details:', error);
    res.status(500).json({ message: 'Failed to fetch menu item details' });
  }
};

// @desc    Approve menu item
export const approveMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: 'Menu Item not found' });
    }

    if (item.status === 'APPROVED') {
      return res.status(400).json({ message: 'Menu Item is already approved' });
    }

    item.status = 'APPROVED';
    item.rejectionReason = undefined;
    item.reviewedAt = new Date();
    item.reviewedBy = req.admin.id;
    item.updatedBy = req.admin.id;
    item.updatedByType = 'Admin';

    await item.save();

    res.json({ message: 'Menu Item approved successfully', data: item });
  } catch (error) {
    if (error.kind === 'ObjectId') return res.status(404).json({ message: 'Menu Item not found' });
    console.error('Error approving menu item:', error);
    res.status(500).json({ message: 'Failed to approve menu item' });
  }
};

// @desc    Reject menu item
export const rejectMenuItem = async (req, res) => {
  try {
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const item = await MenuItem.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: 'Menu Item not found' });
    }

    item.status = 'REJECTED';
    item.rejectionReason = rejectionReason;
    item.reviewedAt = new Date();
    item.reviewedBy = req.admin.id;
    item.updatedBy = req.admin.id;
    item.updatedByType = 'Admin';

    await item.save();

    res.json({ message: 'Menu Item rejected successfully', data: item });
  } catch (error) {
    if (error.kind === 'ObjectId') return res.status(404).json({ message: 'Menu Item not found' });
    console.error('Error rejecting menu item:', error);
    res.status(500).json({ message: 'Failed to reject menu item' });
  }
};
