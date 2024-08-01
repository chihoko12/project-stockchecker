'use strict';

const fetch = require('node-fetch');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Stock = require('../models/Stock');

mongoose.connect(process.env.DB, { useNewUrlParser: true, useUnifiedTopology: true });

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(async function (req, res) {
      const { stock, like } = req.query;
      const ip = req.ip;

      if (!stock) return res.json({ error: 'missing stock symbol' });

      const stockArray = Array.isArray(stock) ? stock : [stock];

      try {
        const stockData = await Promise.all(stockArray.map(async (symbol) => {
          const response = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${symbol}/quote`);
          const data = await response.json();

          if (!data || data === 'Unknown symbol') {
            return { error: 'external source error', stock: symbol };
          }

          const hashIp = crypto.createHash('sha256').update(ip).digest('hex');
          let stockDocument = await Stock.findOne({ symbol });

          if (like === 'true') {
            if (!stockDocument) {
              stockDocument = new Stock({ symbol, likes: [hashIp] });
            } else if (!stockDocument.likes.includes(hashIp)) {
              stockDocument.likes.push(hashIp);
            }
            await stockDocument.save();
          }

          const likesCount = stockDocument ? stockDocument.likes.length : 0;
          return { stock: data.symbol, price: data.latestPrice, likes: likesCount };
        }));

        if (stockArray.length === 1) {
          res.json(stockData[0]);
        } else {
          res.json({ stockData });
        }
      } catch (error) {
        res.json({ error: 'error retrieving data' });
      }
    });
};
