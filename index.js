const {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");
const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
try {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[AVISO] O comando em ${filePath} não possui as propriedades "data" ou "execute".`
      );
    }
  }
} catch (error) {
  console.warn(
    `[AVISO] Não foi possível carregar comandos da pasta 'commands'. Ela pode estar vazia ou não existir. Erro: ${error.message}`
  );
}

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

const PANEL_MESSAGE_ID_FILE = path.join(__dirname, "panel_message_id.json");

async function getPanelMessageId() {
  try {
    const data = await fs.promises.readFile(PANEL_MESSAGE_ID_FILE, "utf8");
    return JSON.parse(data).messageId;
  } catch (error) {
    return null;
  }
}

async function savePanelMessageId(messageId) {
  try {
    await fs.promises.writeFile(
      PANEL_MESSAGE_ID_FILE,
      JSON.stringify({ messageId }),
      "utf8"
    );
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}] Erro ao salvar ID da mensagem do painel:`,
      error
    );
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Pronto! Logado como ${c.user.tag}`);

  const panelChannelId = process.env.TICKET_PANEL_CHANNEL_ID;
  if (!panelChannelId) {
    console.error(
      `[${new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}] TICKET_PANEL_CHANNEL_ID não configurado no .env! O painel de tickets automático não será enviado.`
    );
    return;
  }

  try {
    const panelChannel = await client.channels.fetch(panelChannelId);

    if (!panelChannel || panelChannel.type !== ChannelType.GuildText) {
      console.error(
        `[${new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })}] Canal do painel de tickets (${panelChannelId}) inválido ou não é um canal de texto.`
      );
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Clique aqui para selecionar...")
      .addOptions([
        {
          label: "Dúvidas",
          description: "Precisa de auxílio da nossa equipe? Use aqui.",
          value: "duvidas",
          emoji: "🌐",
        },
        {
          label: "Doação/Loja",
          description: "Precisa de auxílio com doações e loja? Use aqui.",
          value: "doacao_loja",
          emoji: "💸",
        },
        {
          label: "Denúncias",
          description:
            "Precisa realizar uma denúncia à nossa equipe? Use aqui.",
          value: "denuncias",
          emoji: "💼",
        },
        {
          label: "Organizações",
          description: "Ticket para organizações do servidor.",
          value: "organizacoes",
          emoji: "🚨",
        },
        {
          label: "Streamers",
          description: "Ticket sobre lives, vídeos e afins.",
          value: "streamers",
          emoji: "🎬",
        },
        {
          label: "Remover Banimento",
          description: "Foi banido e gostaria de revogar?",
          value: "remover_banimento",
          emoji: "🔨",
        },
        {
          label: "Outros",
          description: "Encontrou um BUG? Use aqui.",
          value: "outros",
          emoji: "🤏",
        },
      ]);

    const row = new ActionRowBuilder().addComponents(select);

    const panelEmbed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle("🎫 Sistema de Ticket Automático")
      .setDescription(
        "Para obter **SUPORTE** abra um ticket selecionando no menu abaixo.\n\n❗ **Lembre-se:** não abra um ticket sem necessidade."
      )
      .setTimestamp();

    let existingMessageId = await getPanelMessageId();
    let panelMessage;

    if (existingMessageId) {
      try {
        panelMessage = await panelChannel.messages.fetch(existingMessageId);
        await panelMessage.edit({ embeds: [panelEmbed], components: [row] });
        console.log(
          `[${new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}] Painel de tickets atualizado no canal: ${panelChannel.name}`
        );
      } catch (error) {
        console.error(
          `[${new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}] Mensagem do painel não encontrada ou erro ao editar. Enviando nova mensagem...`,
          error.message
        );
        panelMessage = await panelChannel.send({
          embeds: [panelEmbed],
          components: [row],
        });
        await savePanelMessageId(panelMessage.id);
        console.log(
          `[${new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}] Novo painel de tickets enviado no canal: ${panelChannel.name}`
        );
      }
    } else {
      panelMessage = await panelChannel.send({
        embeds: [panelEmbed],
        components: [row],
      });
      await savePanelMessageId(panelMessage.id);
      console.log(
        `[${new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })}] Painel de tickets enviado pela primeira vez no canal: ${
          panelChannel.name
        }`
      );
    }
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}] Erro ao gerenciar o painel de tickets automático:`,
      error
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
