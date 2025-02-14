const mongoose = require('mongoose');

const searchSessionSchema = new mongoose.Schema({
    userId: String,
    results: Array,
});

module.exports = mongoose.model('SearchSession', searchSessionSchema);
