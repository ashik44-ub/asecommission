const app = require('./api/index.js');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`Commission Dashboard Server is running locally!`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`MongoDB state: Checking connection...`);
  console.log(`===================================================`);
});
