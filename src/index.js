require('dotenv').config();
const {
    Client,
    IntentsBitField,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonStyle,
    ButtonBuilder,
    EmbedBuilder,
} = require('discord.js');
const mongoose = require('mongoose');
const axios = require('axios');
const Rating = require('./models/Rating');
const SearchSession = require('./models/SearchSession');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

client.on('ready', () => {
    console.log(`✅ ${client.user.tag} is ready!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'search') {
        const query = interaction.options.get('query').value;

        try {
            const response = await axios.get(
                `https://api.themoviedb.org/3/search/multi?api_key=${
                    process.env.TMDB_API_KEY
                }&query=${encodeURIComponent(query)}&language=en`
            );

            const results = response.data.results
                .filter(
                    item =>
                        item.media_type === 'movie' || item.media_type === 'tv'
                )
                .slice(0, 5);

            if (results.length === 0) {
                return interaction.reply('Nothing found 😞');
            }

            const options = results.map((item, index) => ({
                label: `${item.title || item.name} (${
                    item.media_type === 'movie' ? 'Movie' : 'Series'
                }) (${
                    (item.release_date || item.first_air_date).split('-')[0]
                })`,
                value: `${item.media_type}_${item.id}`,
            }));

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('search_select')
                    .setPlaceholder('Choose an option...')
                    .addOptions(options)
            );

            const embed = new EmbedBuilder()
                .setTitle('Search Results')
                .setDescription('Choose one from the dropdown menu')
                .setColor('#0099ff');

            await SearchSession.updateOne(
                { userId: interaction.user.id },
                { $set: { results: results } },
                {
                    upsert: true,
                    setDefaultsOnInsert: true,
                }
            );

            await interaction.reply({
                embeds: [embed],
                components: [selectMenu],
            });
        } catch (error) {
            console.log(error);
            interaction.reply('Search failed 😞');
        }
    }

    if (interaction.commandName === 'list') {
        const targetUser =
            interaction.options.getUser('user') || interaction.user;

        try {
            console.log(targetUser);
            const ratings = await Rating.find({ userId: targetUser.id });

            if (ratings.length === 0) {
                return interaction.reply(
                    targetUser.id === interaction.user.id
                        ? 'Your list is empty 🎬'
                        : `${targetUser.username} hasn't rated anything yet`
                );
            }

            const fields = ratings.map(rating => ({
                name: `${rating.title} (${
                    rating.type === 'movie' ? 'Movie' : 'Series'
                })`,
                value: `Rating: ${'⭐'.repeat(rating.rating)} (${
                    rating.rating
                }/5)`,
                inline: true,
            }));

            const embed = new EmbedBuilder()
                .setTitle(
                    `${targetUser.username}'s Ratings (${ratings.length})`
                )
                .setColor('#00b4d8')
                .addFields(fields);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.log(error);
            await interaction.reply('Error fetching list 😞');
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'search_select') {
        const [type, tmdbId] = interaction.values[0].split('_');

        const session = await SearchSession.findOne({
            userId: interaction.user.id,
        });
        if (!session)
            return interaction.update('Session expired. Please search again.');

        let selected;
        for (const item of session.results) {
            if (item.id === Number(tmdbId)) {
                selected = item;
                break;
            }
        }
        console.log(selected);

        const embed = new EmbedBuilder()
            .setTitle(`${selected.title || selected.name}`)
            .setDescription(selected.release_date || selected.first_air_date)
            .setImage(
                `https://image.tmdb.org/t/p/w1280${selected.backdrop_path}`
            )
            .setThumbnail(
                `https://image.tmdb.org/t/p/w500${selected.poster_path}`
            )
            .setColor('#00b4d8')
            .setFooter({ text: `Powered by TMDB` });

        const row = new ActionRowBuilder();
        ['1', '2', '3', '4', '5'].forEach(rating => {
            row.components.push(
                new ButtonBuilder()
                    .setCustomId(`rating_${rating}`)
                    .setLabel(rating)
                    .setStyle(ButtonStyle.Success)
            );
        });

        await SearchSession.updateOne(
            { userId: interaction.user.id },
            { $set: { results: [selected] } }
        );

        await interaction.update({
            content: '',
            embeds: [embed],
            components: [row],
        });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('rating')) {
        try {
            const rating = interaction.customId.split('_')[1];

            const session = await SearchSession.findOne({
                userId: interaction.user.id,
            });
            if (!session)
                return interaction.update(
                    'Session expired. Please search again.'
                );

            const selected = session.results[0];

            const ratingData = {
                userId: interaction.user.id,
                tmdbId: selected.id,
                title: selected.title || selected.name,
                rating: Number(rating),
                type: selected.media_type === 'movie' ? 'movie' : 'tv',
            };

            await Rating.create(ratingData);
            await interaction.update({
                content: 'Rating saved',
                components: [],
            });
        } catch (error) {
            console.log(error);
            await interaction.update({
                content: 'Error saving rating',
                components: [],
            });
        }
    }
});

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            dbName: process.env.DB_NAME,
        });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.log(`Error connecting to MongoDB: ${error}`);
    }
})();

client.login(process.env.TOKEN);
