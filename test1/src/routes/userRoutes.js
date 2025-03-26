const express = require('express');
const routes = express.Router();

routes.get('/', (req, res) => res.send('suman'));
routes.get('/age', (req, res) => res.send('24'));
routes.get('/color', (req, res) => res.send('black'));

module.exports = routes;
