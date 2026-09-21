import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userType: {
      type: String,
      enum: ['CUSTOMER', 'RESTAURANT', 'DELIVERY_PARTNER'],
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant'
    },
    deliveryPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryPartner'
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription'
    },
    subscriptionOccurrenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionOccurrence'
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: [
        'ORDER_ISSUE',
        'PAYMENT',
        'REFUND',
        'DELIVERY',
        'RESTAURANT',
        'SUBSCRIPTION',
        'ACCOUNT',
        'TECHNICAL',
        'OTHER'
      ],
      default: 'ORDER_ISSUE',
      index: true
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
      index: true
    },
    status: {
      type: String,
      enum: [
        'OPEN',
        'IN_PROGRESS',
        'WAITING_FOR_CUSTOMER',
        'WAITING_FOR_PARTNER',
        'RESOLVED',
        'CLOSED'
      ],
      default: 'OPEN',
      index: true
    },
    attachments: [
      {
        type: String
      }
    ],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: {
      type: Date
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: {
      type: Date
    },
    closedAt: {
      type: Date
    },
    messages: [
      {
        senderType: {
          type: String,
          enum: ['CUSTOMER', 'RESTAURANT', 'DELIVERY_PARTNER', 'SUPER_ADMIN', 'SUPPORT_AGENT', 'USER'],
          required: true
        },
        senderId: {
          type: mongoose.Schema.Types.ObjectId
        },
        senderName: {
          type: String,
          default: 'Support'
        },
        message: {
          type: String,
          required: true
        },
        attachments: [
          {
            type: String
          }
        ],
        isInternalNote: {
          type: Boolean,
          default: false
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Compound indexes for optimal querying
supportTicketSchema.index({ userId: 1, userType: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });

const SupportTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);

export default SupportTicket;

