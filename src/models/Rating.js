const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    userId: String,
    tmdbId: Number,
    title: String,
    rating: Number,
    type: String,
    date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Rating', ratingSchema);
