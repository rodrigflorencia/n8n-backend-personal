const express = require('express');

const router = express.Router();

router.post('/process-invoice', (req, res) => {
  res.status(200).send('ok');
});

module.exports = router;