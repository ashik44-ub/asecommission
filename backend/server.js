const app = require('./backend/api/index.js'); // ব্যাকএন্ড এক্সপ্রেস অ্যাপের সঠিক পাথ
const dotenv = require('dotenv');
const path = require('path');

// লোকাল পিসিতে রুট ডিরেক্টরির .env ফাইলটি লোড করার জন্য সঠিক পাথ সেট করা
dotenv.config({ path: path.join(__dirname, './.env') });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Commission Dashboard Server is running locally!`);
  console.log(`🌐 Local URL:  http://localhost:${PORT}`);
  console.log(`✨ Live URL:   https://commission-ase.vercel.app`);
  console.log(`📂 MongoDB connection: Checking state...`);
  console.log(`===================================================`);
});