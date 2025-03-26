const express = require('express');
const routes = express.Router();
const productRoutes = require('./productRoutes');
const userRoutes = require('./userRoutes');

routes.use('/products', productRoutes);
routes.use('/user', userRoutes);

module.exports = routes;
