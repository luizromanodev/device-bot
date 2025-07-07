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

const { logInfo, logWarn, logError } = require("./utils/logger");
const {
  checkInactiveTickets,
  updateTicketActivity,
} = require("./utils/ticketManager");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection(); // Coleção para comandos de barra

// Carregar comandos de barra
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
      logWarn(
        `O comando em ${filePath} não possui as propriedades "data" ou "execute".`
      );
    }
  }
} catch (error) {
  logWarn(
    `Não foi possível carregar comandos da pasta 'commands'. Ela pode estar vazia ou não existir. Erro: ${error.message}`
  );
}

// Carregar eventos
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

// Função para ler o ID da mensagem do painel
async function getPanelMessageId() {
  try {
    const data = await fs.promises.readFile(PANEL_MESSAGE_ID_FILE, "utf8");
    return JSON.parse(data).messageId;
  } catch (error) {
    logWarn(
      `Não foi possível ler panel_message_id.json, iniciando sem ID de mensagem existente.`,
      error.message
    );
    return null;
  }
}

// Função para salvar o ID da mensagem do painel
async function savePanelMessageId(messageId) {
  try {
    await fs.promises.writeFile(
      PANEL_MESSAGE_ID_FILE,
      JSON.stringify({ messageId }),
      "utf8"
    );
  } catch (error) {
    logError(`Erro ao salvar ID da mensagem do painel:`, error);
  }
}

// Evento quando o bot está pronto
client.once(Events.ClientReady, async (c) => {
  logInfo(`Pronto! Logado como ${c.user.tag}`);

  // Agendar verificação de tickets inativos
  const checkIntervalMinutes = parseInt(
    process.env.TICKET_INACTIVITY_CHECK_INTERVAL_MINUTES || "30",
    10
  );
  if (checkIntervalMinutes > 0) {
    logInfo(`Iniciando verificação inicial de tickets inativos.`);
    await checkInactiveTickets(client);
    setInterval(() => {
      logInfo(`Executando verificação agendada de tickets inativos.`);
      checkInactiveTickets(client);
    }, checkIntervalMinutes * 60 * 1000);
    logInfo(
      `Verificação de tickets inativos agendada para cada ${checkIntervalMinutes} minutos.`
    );
  } else {
    logWarn(
      `TICKET_INACTIVITY_CHECK_INTERVAL_MINUTES está desativado (<= 0). Auto-fechamento de tickets inativos não será executado.`
    );
  }

  // Gerenciar o painel de tickets automático
  const panelChannelId = process.env.TICKET_PANEL_CHANNEL_ID;
  if (!panelChannelId) {
    logError(
      `TICKET_PANEL_CHANNEL_ID não configurado no .env! O painel de tickets automático não será enviado.`
    );
    return;
  }

  try {
    const panelChannel = await client.channels
      .fetch(panelChannelId)
      .catch(() => null);

    if (!panelChannel || panelChannel.type !== ChannelType.GuildText) {
      logError(
        `Canal do painel de tickets (${panelChannelId}) inválido ou não é um canal de texto.`
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
        logInfo(`Painel de tickets atualizado no canal: ${panelChannel.name}`);
      } catch (error) {
        logError(
          `Mensagem do painel não encontrada ou erro ao editar. Enviando nova mensagem...`,
          error
        );
        panelMessage = await panelChannel.send({
          embeds: [panelEmbed],
          components: [row],
        });
        await savePanelMessageId(panelMessage.id);
        logInfo(
          `Novo painel de tickets enviado no canal: ${panelChannel.name}`
        );
      }
    } else {
      panelMessage = await panelChannel.send({
        embeds: [panelEmbed],
        components: [row],
      });
      await savePanelMessageId(panelMessage.id);
      logInfo(
        `Painel de tickets enviado pela primeira vez no canal: ${panelChannel.name}`
      );
    }
  } catch (error) {
    logError(`Erro ao gerenciar o painel de tickets automático:`, error);
  }
});

client.login(process.env.DISCORD_TOKEN);
