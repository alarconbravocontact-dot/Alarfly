const asyncHandler = require('../utils/asyncHandler');
const { parseTabularFile } = require('../utils/tabularFileParser');

const parseFile = asyncHandler(async (req, res) => {
  const { filename, contentBase64 } = req.body;
  res.json(await parseTabularFile(filename, contentBase64));
});

module.exports = { parseFile };
