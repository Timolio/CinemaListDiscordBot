module.exports = (rating, maxRating = 5) => {
    const filledStar = '⭐';
    const emptyStar = '⚫';

    const filledStars = filledStar.repeat(rating);
    const emptyStars = emptyStar.repeat(maxRating - rating);

    return filledStars + emptyStars;
};
