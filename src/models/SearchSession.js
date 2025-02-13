const mongoose = require('mongoose');

const searchSessionSchema = new mongoose.Schema({
    userId: String,
    results: Array,
    expiresAt: { type: Date, default: Date.now, expires: 300 },
});

module.exports = mongoose.model('SearchSession', searchSessionSchema);
