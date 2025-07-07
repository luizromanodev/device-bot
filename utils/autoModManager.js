const { EmbedBuilder, ChannelType } = require("discord.js");
const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config();

const blacklistedWords = process.env.BLACKLISTED_WORDS
  ? process.env.BLACKLISTED_WORDS.split(",").map((word) =>
      word.trim().toLowerCase()
    )
  : [];
const automodLogChannelId = process.env.AUTOMOD_LOG_CHANNEL_ID;

// Regex para convites do Discord (discord.gg, discord.com/invite)
const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/)([a-zA-Z0-9]+)/g;

const userMessageHistory = new Map();

// Variáveis de configuração de spam
const spamMessageLimit = parseInt(process.env.SPAM_MESSAGE_LIMIT || "5", 10);
const spamTimeWindowSeconds = parseInt(
  process.env.SPAM_TIME_WINDOW_SECONDS || "10",
  10
);

// Listener para limpar o histórico de spam de usuários a cada X tempo
setInterval(() => {
  const cleanupThreshold = 5 * spamTimeWindowSeconds * 1000;
  const now = Date.now();
  for (const [userId, history] of userMessageHistory.entries()) {
    history.messages = history.messages.filter(
      (timestamp) => now - timestamp < cleanupThreshold
    );

    if (
      history.messages.length === 0 &&
      (!history.lastSpamLogged ||
        now - history.lastSpamLogged > cleanupThreshold)
    ) {
      userMessageHistory.delete(userId);
      // console.log(`[${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] Limpando histórico de spam para usuário ${userId}.`);
    }
  }
}, 60 * 60 * 1000);

async function checkMessageForBlacklistedWords(message) {
  if (!blacklistedWords.length) return false;

  const content = message.content.toLowerCase();
  let detectedWords = [];

  for (const word of blacklistedWords) {
    if (content.includes(word)) {
      detectedWords.push(word);
    }
  }

  if (detectedWords.length > 0) {
    try {
      if (message.deletable) {
        await message.delete();
      }
    } catch (error) {
      console.error(
        `[${new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })}] Erro ao deletar mensagem com palavra proibida: ${error.stack}`
      );
    }

    if (automodLogChannelId) {
      try {
        const logChannel = await message.guild.channels.fetch(
          automodLogChannelId
        );
        if (logChannel && logChannel.type === ChannelType.GuildText) {
          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("🚫 Auto-Moderação: Palavra Proibida Detectada")
            .setDescription(
              `A mensagem de ${message.author.tag} foi deletada por conter palavras proibidas.`
            )
            .addFields(
              {
                name: "Usuário",
                value: `<@${message.author.id}> (${message.author.tag})`,
                inline: true,
              },
              {
                name: "Canal",
                value: `<#${message.channel.id}>`,
                inline: true,
              },
              {
                name: "Palavras Detectadas",
                value: detectedWords.join(", "),
                inline: false,
              },
              {
                name: "Conteúdo Original",
                value: `\`\`\`${message.content}\`\`\``,
                inline: false,
              }
            )
            .setTimestamp()
            .setFooter({ text: `ID do Usuário: ${message.author.id}` });

          await logChannel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error(
          `[${new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}] Erro ao enviar log de auto-moderação (palavra proibida): ${
            error.stack
          }`
        );
      }
    }
    return true;
  }
  return false;
}

async function checkMessageForInvites(message) {
  if (!message.guild) return false;

  const content = message.content;
  const matches = content.match(inviteRegex);

  if (matches && matches.length > 0) {
    try {
      if (message.deletable) {
        await message.delete();
      }
    } catch (error) {
      console.error(
        `[${new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })}] Erro ao deletar mensagem com convite: ${error.stack}`
      );
    }

    if (automodLogChannelId) {
      try {
        const logChannel = await message.guild.channels.fetch(
          automodLogChannelId
        );
        if (logChannel && logChannel.type === ChannelType.GuildText) {
          const embed = new EmbedBuilder()
            .setColor(0xff8c00)
            .setTitle("🚨 Auto-Moderação: Convite Detectado")
            .setDescription(
              `A mensagem de ${message.author.tag} foi deletada por conter um convite para outro servidor.`
            )
            .addFields(
              {
                name: "Usuário",
                value: `<@${message.author.id}> (${message.author.tag})`,
                inline: true,
              },
              {
                name: "Canal",
                value: `<#${message.channel.id}>`,
                inline: true,
              },
              {
                name: "Convites Detectados",
                value: matches.join(", "),
                inline: false,
              },
              {
                name: "Conteúdo Original",
                value: `\`\`\`${message.content}\`\`\``,
                inline: false,
              }
            )
            .setTimestamp()
            .setFooter({ text: `ID do Usuário: ${message.author.id}` });

          await logChannel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error(
          `[${new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}] Erro ao enviar log de auto-moderação (convite): ${error.stack}`
        );
      }
    }
    return true;
  }
  return false;
}

async function checkMessageForSpam(message) {
  if (!message.guild) return false;
  if (message.author.bot) return false;

  const userId = message.author.id;
  const now = Date.now();

  if (!userMessageHistory.has(userId)) {
    userMessageHistory.set(userId, { messages: [], lastSpamLogged: 0 });
  }

  const userHistory = userMessageHistory.get(userId);

  userHistory.messages.push(now);

  // Remove mensagens antigas que estão fora da janela de tempo
  const timeWindowMs = spamTimeWindowSeconds * 1000;
  userHistory.messages = userHistory.messages.filter(
    (timestamp) => now - timestamp < timeWindowMs
  );
  userMessageHistory.set(userId, userHistory);

  // Verifica se o número de mensagens excede o limite
  if (userHistory.messages.length > spamMessageLimit) {
    // Se for spam, apaga as mensagens recentes do usuário no canal
    try {
      // Busca um pouco mais de mensagens para garantir que pega todas no surto de spam
      const fetchedMessages = await message.channel.messages.fetch({
        limit: Math.min(userHistory.messages.length + 5, 100),
      });
      const messagesToDelete = fetchedMessages.filter(
        (msg) =>
          msg.author.id === userId && now - msg.createdTimestamp < timeWindowMs
      );

      if (messagesToDelete.size > 0) {
        await message.channel.bulkDelete(messagesToDelete, true);
      }
    } catch (error) {
      console.error(
        `[${new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })}] Erro ao deletar mensagens de spam: ${error.stack}`
      );
    }

    // O log só será enviado se já passou tempo suficiente desde o último log de spam para este usuário.
    const logSentThreshold = 2 * spamTimeWindowSeconds * 1000;
    if (now - userHistory.lastSpamLogged > logSentThreshold) {
      if (automodLogChannelId) {
        try {
          const logChannel = await message.guild.channels.fetch(
            automodLogChannelId
          );
          if (logChannel && logChannel.type === ChannelType.GuildText) {
            const embed = new EmbedBuilder()
              .setColor(0xffa500)
              .setTitle("⚡ Auto-Moderação: Spam Detectado")
              .setDescription(
                `As mensagens de ${message.author.tag} foram deletadas por spam.`
              )
              .addFields(
                {
                  name: "Usuário",
                  value: `<@${message.author.id}> (${message.author.tag})`,
                  inline: true,
                },
                {
                  name: "Canal",
                  value: `<#${message.channel.id}>`,
                  inline: true,
                },
                {
                  name: "Mensagens Enviadas",
                  value: `${userHistory.messages.length} em ${spamTimeWindowSeconds} segundos`,
                  inline: false,
                }
              )
              .setTimestamp()
              .setFooter({ text: `ID do Usuário: ${message.author.id}` });

            await logChannel.send({ embeds: [embed] });
            userHistory.lastSpamLogged = now; // Marca que o log foi enviado AGORA
          }
        } catch (error) {
          console.error(
            `[${new Date().toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}] Erro ao enviar log de auto-moderação (spam): ${error.stack}`
          );
        }
      }
    }
    return true;
  }
  return false;
}

module.exports = {
  checkMessageForBlacklistedWords,
  checkMessageForInvites,
  checkMessageForSpam,
};
