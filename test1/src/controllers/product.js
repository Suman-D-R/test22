const productServices = require('../services/product');

module.exports.getUsers = (req, res) => {
  const data = productServices.getUser();
  res.send({
    data: data,
  });
};
