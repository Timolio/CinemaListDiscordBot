const mongoose = require('mongoose');

const searchSessionSchema = new mongoose.Schema({
    userId: String,
    results: Array,
    expiresAt: { type: Date, default: Date.now, expires: 3000 },
});

module.exports = mongoose.model('SearchSession', searchSessionSchema);
