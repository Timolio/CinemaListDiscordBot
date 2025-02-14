require('dotenv').config();
const {
    Client,
    IntentsBitField,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonStyle,
    ButtonBuilder,
    EmbedBuilder,
    MessageFlags,
} = require('discord.js');
const mongoose = require('mongoose');
const axios = require('axios');
const Rating = require('./models/Rating');
const SearchSession = require('./models/SearchSession');
const getRatingString = require('./utils/getRatingString');

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
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
                return interaction.editReply({
                    content: 'Nothing found 😞',
                });
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
                {
                    $set: {
                        results: results,
                    },
                },
                {
                    upsert: true,
                }
            );

            await interaction.editReply({
                embeds: [embed],
                components: [selectMenu],
            });
        } catch (error) {
            console.log(error);
            interaction.editReply({
                content: 'Search failed 😞',
            });
        }
    }

    if (interaction.commandName === 'list') {
        await interaction.deferReply();

        const targetUser =
            interaction.options.getUser('user') || interaction.user;

        try {
            console.log(targetUser);
            const ratings = await Rating.find({ userId: targetUser.id });

            if (ratings.length === 0) {
                return interaction.editReply(
                    targetUser.id === interaction.user.id
                        ? 'Your list is empty 🎬'
                        : `${targetUser.username} hasn't rated anything yet`
                );
            }

            const fields = ratings.map(rating => ({
                name: `${rating.title}`,
                value: getRatingString(rating.rating),
                inline: true,
            }));

            const embed = new EmbedBuilder()
                .setTitle(
                    `${targetUser.username}'s Ratings (${ratings.length})`
                )
                .setColor('#00b4d8')
                .addFields(fields);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.log(error);
            await interaction.editReply('Error fetching list 😞');
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

        const rating = await Rating.findOne({
            userId: interaction.user.id,
            tmdbId: Number(tmdbId),
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

        const options = [
            { label: 'None', value: 'delete_rating' },
            { label: '1 ★', value: '1' },
            { label: '2 ★★', value: '2' },
            { label: '3 ★★★', value: '3' },
            { label: '4 ★★★★', value: '4' },
            { label: '5 ★★★★★', value: '5' },
        ];

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

        if (rating) {
            embed.addFields({
                name: '',
                value: getRatingString(rating.rating),
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('rating_select')
            .setPlaceholder('Select a rating...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

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

    if (interaction.customId === 'rating_select') {
        try {
            const session = await SearchSession.findOne({
                userId: interaction.user.id,
            });
            const selected = session.results[0];

            let field;

            if (interaction.values[0] === 'delete_rating') {
                await Rating.deleteOne({
                    userId: interaction.user.id,
                    tmdbId: selected.id,
                });

                field = [];
            } else {
                const rating = Number(interaction.values[0]);

                if (!session)
                    return interaction.update(
                        'Session expired. Please search again.'
                    );

                const ratingData = {
                    title: selected.title || selected.name,
                    type: selected.media_type === 'movie' ? 'movie' : 'tv',
                };

                await Rating.updateOne(
                    { userId: interaction.user.id, tmdbId: selected.id },
                    {
                        $set: {
                            rating,
                        },
                        $setOnInsert: ratingData,
                    },
                    {
                        upsert: true,
                    }
                );

                field = [{ name: '', value: getRatingString(rating) }];
            }

            const embed = interaction.message.embeds[0];

            embed.data.fields = field;

            await interaction.update({
                embeds: [embed],
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
