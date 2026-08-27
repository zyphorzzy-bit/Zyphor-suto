const { 
    Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, 
    ComponentType, ActivityType, EmbedBuilder, SlashCommandBuilder, 
    ButtonBuilder, ButtonStyle, REST, Routes 
} = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIXO = 'f.';

client.once('ready', async () => {
    console.log(`Bot online como ${client.user.tag}!`);
    atualizarStream('Gerenciando Parcerias');

    const commands = [
        new SlashCommandBuilder()
            .setName('parceria')
            .setDescription('Abre o painel de configuração do sistema de parcerias.')
    ];

    const rest = new REST({ version: '10' }).setToken(client.token);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Comando /parceria registrado com sucesso!');
    } catch (error) {
        console.error(error);
    }
});

function atualizarStream(nomeStatus) {
    client.user.setPresence({
        activities: [{
            name: nomeStatus,
            type: ActivityType.Streaming,
            url: 'https://www.twitch.tv/twitch'
        }],
        status: 'online'
    });
}

function temPermissao(member) {
    let dados = JSON.parse(fs.readFileSync('./dados.json'));
    if (dados.usuariosAutorizados.includes(member.id)) return true;
    if (dados.cargoAutorizado && member.roles.cache.has(dados.cargoAutorizado)) return true;
    return false;
}

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'parceria') {
            if (!temPermissao(interaction.member)) {
                return interaction.reply({ content: '<:negativo:1534612858548256921> Você não tem permissão para abrir este painel.', ephemeral: true });
            }

            let dados = JSON.parse(fs.readFileSync('./dados.json'));
            const cargoNome = dados.cargoAutorizado ? `<@&${dados.cargoAutorizado}>` : 'Nenhum definido';

            const embedPainel = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('<:zyphor:1540096483276095621> Painel de Configuração - Parcerias')
                .setDescription('Gerencie as configurações do sistema de parcerias do servidor abaixo:')
                .addFields(
                    { name: '<:arquivo:1539124693460713552> Texto Atual:', value: dados.textoParceria.length > 100 ? dados.textoParceria.substring(0, 100) + '...' : dados.textoParceria },
                    { name: '<:perfil:1540557352602705990> Cargo Autorizado:', value: cargoNome },
                    { name: '<:fixo:1541318082574684240> Título do Embed:', value: dados.embedConfig.titulo }
                )
                .setFooter({ text: 'Use os comandos de texto (f.texto, f.cargo, f.embed) para alterar os valores.' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_ver_texto')
                    .setLabel('Ver Texto Completo')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('1539124693460713552'),
                new ButtonBuilder()
                    .setCustomId('btn_ajuda')
                    .setLabel('Como Usar')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('1534611993410015456')
            );

            await interaction.reply({ embeds: [embedPainel], components: [row], ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        let dados = JSON.parse(fs.readFileSync('./dados.json'));
        if (interaction.customId === 'btn_ver_texto') {
            await interaction.reply({ content: `<:arquivo:1539124693460713552> **Texto Oficial Atual:**\n\n${dados.textoParceria}`, ephemeral: true });
        } else if (interaction.customId === 'btn_ajuda') {
            await interaction.reply({ 
                content: '<:zyphor:1540096483276095621> **Comandos Disponíveis:**\n- `f.parc` (Inicia o menu de parceria no canal)\n- `f.texto [novo texto]` (Altera o texto)\n- `f.cargo @cargo` (Define cargo autorizado)\n- `f.stream [nome]` (Muda o status da stream)\n- `f.embed [titulo/cor/footer] [valor]` (Personaliza o embed)\n- `f.delparc @usuario` (Deleta a parceria feita com a pessoa)', 
                ephemeral: true 
            });
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIXO)) return;

    const args = message.content.slice(PREFIXO.length).trim().split(/ +/);
    const comando = args.shift().toLowerCase();

    if (comando === 'delparc') {
        if (!temPermissao(message.member)) {
            return message.reply('<:negativo:1534612858548256921> Você não tem permissão para deletar parcerias.');
        }

        const usuarioMencionado = message.mentions.users.first();
        if (!usuarioMencionado) return message.reply('<:alerta:1534611993410015456> Mencione o usuário da parceria que deseja apagar! Ex: `f.delparc @usuario`');

        try {
            const mensagens = await message.channel.messages.fetch({ limit: 50 });
            let apagadas = 0;

            for (const msg of mensagens.values()) {
                if (msg.author.id === client.user.id && (msg.embeds.length > 0 && msg.embeds[0].description?.includes(usuarioMencionado.id))) {
                    await msg.delete().catch(() => {});
                    apagadas++;
                }
            }

            return message.reply(`<:zyphor:1540096483276095621> Parceria com ${usuarioMencionado} localizada e limpa do canal!`);
        } catch (error) {
            return message.reply('<:negativo:1534612858548256921> Ocorreu um erro ao tentar deletar a parceria.');
        }
    }

    if (comando === 'embed') {
        if (!temPermissao(message.member)) {
            return message.reply('<:negativo:1534612858548256921> Você não tem permissão para alterar o embed.');
        }

        const opcao = args[0]?.toLowerCase();
        const valor = args.slice(1).join(' ');

        let dados = JSON.parse(fs.readFileSync('./dados.json'));
        if (!dados.embedConfig) dados.embedConfig = { titulo: "Parceria Firmada!", cor: "#2b2d31", footer: "Sistema de Parcerias" };

        if (opcao === 'titulo') {
            if (!valor) return message.reply('<:alerta:1534611993410015456> Digite o título.');
            dados.embedConfig.titulo = valor;
            fs.writeFileSync('./dados.json', JSON.stringify(dados, null, 2));
            return message.reply(`<:zyphor:1540096483276095621> Título alterado para: **${valor}**`);
        }

        if (opcao === 'cor') {
            if (!valor || !/^#[0-9A-F]{6}$/i.test(valor)) return message.reply('<:alerta:1534611993410015456> Digite uma cor Hex válida. Ex: `f.embed cor #ff0000`');
            dados.embedConfig.cor = valor;
            fs.writeFileSync('./dados.json', JSON.stringify(dados, null, 2));
            return message.reply(`<:zyphor:1540096483276095621> Cor alterada para: **${valor}**`);
        }

        if (opcao === 'footer') {
            if (!valor) return message.reply('<:alerta:1534611993410015456> Digite o texto do rodapé.');
            dados.embedConfig.footer = valor;
            fs.writeFileSync('./dados.json', JSON.stringify(dados, null, 2));
            return message.reply(`<:zyphor:1540096483276095621> Rodapé alterado para: **${valor}**`);
        }

        return message.reply('<:alerta:1534611993410015456> Use: `f.embed titulo <texto>`, `f.embed cor <hex>` ou `f.embed footer <texto>`');
    }

    if (comando === 'stream') {
        if (!temPermissao(message.member)) return message.reply('<:negativo:1534612858548256921> Sem permissão.');
        const novoNome = args.join(' ');
        if (!novoNome) return message.reply('<:alerta:1534611993410015456> Digite o novo nome da stream!');
        atualizarStream(novoNome);
        return message.reply(`<:zyphor:1540096483276095621> Nome da stream alterado para: **${novoNome}**`);
    }

    if (comando === 'cargo') {
        if (!temPermissao(message.member)) return message.reply('<:negativo:1534612858548256921> Sem permissão.');
        const cargoMencionado = message.mentions.roles.first();
        if (!cargoMencionado) return message.reply('<:alerta:1534611993410015456> Mencione o cargo!');
        let dados = JSON.parse(fs.readFileSync('./dados.json'));
        dados.cargoAutorizado = cargoMencionado.id;
        fs.writeFileSync('./dados.json', JSON.stringify(dados, null, 2));
        return message.reply(`<:zyphor:1540096483276095621> Cargo ${cargoMencionado.name} definido!`);
    }

    if (comando === 'texto') {
        if (!temPermissao(message.member)) return message.reply('<:negativo:1534612858548256921> Sem permissão.');
        const novoTexto = args.join(' ');
        if (!novoTexto) return message.reply('<:alerta:1534611993410015456> Escreva o texto!');
        let dados = JSON.parse(fs.readFileSync('./dados.json'));
        dados.textoParceria = novoTexto;
        fs.writeFileSync('./dados.json', JSON.stringify(dados, null, 2));
        return message.reply('<:zyphor:1540096483276095621> Texto atualizado!');
    }

    if (comando === 'parc') {
        if (!temPermissao(message.member)) return message.reply('<:negativo:1534612858548256921> Sem permissão.');

        const menu = new StringSelectMenuBuilder()
            .setCustomId('menu_parceria')
            .setPlaceholder('Escolha uma opção...')
            .addOptions([
                { label: 'Fechar Parceria', description: 'Envia a parceria e registra quem fechou.', value: 'fechar_parceria', emoji: '1541318082574684240' },
                { label: 'Pegar Nosso Texto', description: 'Exibe o texto do nosso servidor.', value: 'pegar_texto', emoji: '1539124693460713552' }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        const painel = await message.channel.send({
            content: '<:sms:1539125782335455292> **Selecione uma opção no menu abaixo para gerenciar a parceria:**',
            components: [row]
        });

        const collector = painel.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });

        collector.on('collect', async (interaction) => {
            let dados = JSON.parse(fs.readFileSync('./dados.json'));

            if (interaction.values[0] === 'pegar_texto') {
                await interaction.reply({ content: `<:arquivo:1539124693460713552> **Nosso Texto:**\n\n${dados.textoParceria}`, ephemeral: true });
            } 
            
            if (interaction.values[0] === 'fechar_parceria') {
                await interaction.reply({ content: '<:horrio:1534611997335883886> Envie o texto/convite do servidor parceiro aqui dentro de 60 segundos:', ephemeral: true });

                const filter = m => m.author.id === interaction.user.id;
                const collectorMensagem = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

                collectorMensagem.on('collect', async (m) => {
                    await interaction.channel.send(`${m.content}`);
                    await interaction.channel.send(`${dados.textoParceria}`);

                    const configEmbed = dados.embedConfig || { titulo: "Parceria Firmada!", cor: "#2b2d31", footer: "Sistema de Parcerias" };

                    const embedConfirmacao = new EmbedBuilder()
                        .setColor(configEmbed.cor)
                        .setTitle(`<:zyphor:1540096483276095621> ${configEmbed.titulo}`)
                        .setDescription(`<:perfil:1540557352602705990> **Representante:** ${m.author}\n<:horrio:1534611997335883886> **Fechado em:** <t:${Math.floor(Date.now() / 1000)}:f>`)
                        .setThumbnail(m.author.displayAvatarURL({ dynamic: true, size: 512 }))
                        .setFooter({ text: configEmbed.footer, iconURL: message.guild.iconURL() });

                    await interaction.channel.send({ embeds: [embedConfirmacao] });

                    if (m.deletable) m.delete();
                });
            }
        });
    }
});

client.login(process.env.TOKEN);
