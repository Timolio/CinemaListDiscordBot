require('dotenv').config();
const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const commands = [
    {
        name: 'search',
        description: 'Search for movies or TV shows',
        options: [
            {
                name: 'query',
                description: 'Search query',
                type: ApplicationCommandOptionType.String,
                required: true,
            },
        ],
    },
    {
        name: 'list',
        description: 'Show ratings list',
        options: [
            {
                name: 'user',
                type: ApplicationCommandOptionType.User,
                description: 'User to check',
                required: false,
            },
        ],
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Regestering slash commands...');

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log('Slash registered successfully...');
    } catch (error) {
        console.log(`There was an error: ${error}`);
    }
})();
