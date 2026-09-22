import mongoose from 'mongoose';
import Restaurant from './models/restaurants/Restaurant.js';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/test-eatoggy-mongoose');
  const restaurant = new Restaurant({
    mobile: '9999999999',
    currentStep: 'WELCOME'
  });
  await restaurant.save();

  const newProof = {
    completed: true,
    submittedAt: new Date(),
    mainPrepStation: {
      url: 'http://test.com',
      originalName: 'test',
      mimeType: 'image/jpeg',
      size: 100,
      uploadedAt: new Date()
    }
  };

  restaurant.kitchenHygieneProof = newProof;
  try {
    await restaurant.save();
    console.log("Success!");
  } catch (e) {
    console.error(e.message);
  }
  process.exit(0);
}
run();
