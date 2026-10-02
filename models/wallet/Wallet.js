import mongoose from 'mongoose';

const WalletSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, unique: true },
  currentBalance: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  totalWithdrawals: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  lastSettlementDate: { type: Date },
  lastSettlementAmount: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Wallet', WalletSchema);
