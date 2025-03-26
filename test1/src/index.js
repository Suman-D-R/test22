const express = require('express');
const env = require('dotenv');
const routes = require('./routes/index');

env.config();
const app = express();

const port = process.env.PORT;

app.use('/api', routes);

app.listen(port, () => {
  console.log('server started', port);
});
