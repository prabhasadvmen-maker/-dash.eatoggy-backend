import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  type: { type: String, enum: ['CREDIT', 'DEBIT', 'SETTLEMENT', 'WITHDRAWAL'], required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  balanceAfter: { type: Number, required: true }
}, { timestamps: true });

export default mongoose.model('Transaction', TransactionSchema);
