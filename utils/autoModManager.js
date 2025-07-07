const { EmbedBuilder, ChannelType } = require("discord.js");
const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config();
const { logInfo, logWarn, logError } = require("./logger");

const blacklistedWords = process.env.BLACKLISTED_WORDS
  ? process.env.BLACKLISTED_WORDS.split(",").map((word) =>
      word.trim().toLowerCase()
    )
  : [];
const automodLogChannelId = process.env.AUTOMOD_LOG_CHANNEL_ID;

const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/)([a-zA-Z0-9]+)/g;

const userMessageHistory = new Map();

// configuração de spam
const spamMessageLimit = parseInt(process.env.SPAM_MESSAGE_LIMIT || "5", 10);
const spamTimeWindowSeconds = parseInt(
  process.env.SPAM_TIME_WINDOW_SECONDS || "10",
  10
);

// Mapeia usuários que foram avisados sobre spam para evitar avisos repetidos em pouco tempo
const spamWarningSent = new Map();
const WARN_COOLDOWN_MS = 60 * 1000;

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
    }
  }

  for (const [userId, timestamp] of spamWarningSent.entries()) {
    if (now - timestamp > WARN_COOLDOWN_MS) {
      spamWarningSent.delete(userId);
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
      // Envia uma DM para o usuário que usou a palavra proibida
      if (!message.author.bot) {
        try {
          const user = await message.author.fetch();
          const dmEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("🚫 Aviso de Moderação: Linguagem Inapropriada")
            .setDescription(
              `Sua mensagem em **${message.guild.name}** foi deletada por conter palavras proibidas.`
            )
            .addFields(
              {
                name: "Conteúdo da Mensagem",
                value: `\`\`\`${message.content}\`\`\``,
                inline: false,
              },
              {
                name: "Palavras Detectadas",
                value: detectedWords.join(", "),
                inline: false,
              }
            )
            .setTimestamp()
            .setFooter({
              text: "Por favor, evite o uso de linguagem ofensiva.",
            });
          await user.send({ embeds: [dmEmbed] });
          logInfo(
            `DM de aviso enviada para ${user.tag} sobre palavra proibida.`
          );
        } catch (dmError) {
          logWarn(
            `Não foi possível enviar DM de aviso sobre palavra proibida para ${message.author.tag} (${message.author.id}):`,
            dmError
          );
        }
      }
    } catch (error) {
      logError(`Erro ao deletar mensagem com palavra proibida:`, error);
    }

    if (automodLogChannelId) {
      try {
        const logChannel = await message.guild.channels
          .fetch(automodLogChannelId)
          .catch(() => null);
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
        } else {
          logWarn(
            `Canal de logs de automoderação (${automodLogChannelId}) inválido ou não é um canal de texto.`
          );
        }
      } catch (error) {
        logError(
          `Erro ao enviar log de auto-moderação (palavra proibida):`,
          error
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
      // Envia uma DM para o usuário que enviou o convite
      if (!message.author.bot) {
        try {
          const user = await message.author.fetch();
          const dmEmbed = new EmbedBuilder()
            .setColor(0xff8c00)
            .setTitle("🚨 Aviso de Moderação: Convite de Servidor Detectado")
            .setDescription(
              `Sua mensagem em **${message.guild.name}** foi deletada por conter convites para outros servidores.`
            )
            .addFields(
              {
                name: "Conteúdo da Mensagem",
                value: `\`\`\`${message.content}\`\`\``,
                inline: false,
              },
              {
                name: "Convites Detectados",
                value: matches.join(", "),
                inline: false,
              }
            )
            .setTimestamp()
            .setFooter({
              text: "Compartilhar convites de outros servidores não é permitido.",
            });
          await user.send({ embeds: [dmEmbed] });
          logInfo(`DM de aviso enviada para ${user.tag} sobre convite.`);
        } catch (dmError) {
          logWarn(
            `Não foi possível enviar DM de aviso sobre convite para ${message.author.tag} (${message.author.id}):`,
            dmError
          );
        }
      }
    } catch (error) {
      logError(`Erro ao deletar mensagem com convite:`, error);
    }

    if (automodLogChannelId) {
      try {
        const logChannel = await message.guild.channels
          .fetch(automodLogChannelId)
          .catch(() => null);
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
        } else {
          logWarn(
            `Canal de logs de automoderação (${automodLogChannelId}) inválido ou não é um canal de texto.`
          );
        }
      } catch (error) {
        logError(`Erro ao enviar log de auto-moderação (convite):`, error);
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
    userMessageHistory.set(userId, {
      messages: [],
      lastSpamLogged: 0,
      spamCount: 0,
    });
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
    userHistory.spamCount++;

    try {
      const fetchedMessages = await message.channel.messages.fetch({
        limit: 50,
      });
      const messagesToDelete = fetchedMessages.filter(
        (msg) =>
          msg.author.id === userId &&
          now - msg.createdTimestamp < timeWindowMs &&
          now - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000
      );

      if (messagesToDelete.size > 0) {
        // Tenta a exclusão em massa para as mensagens elegíveis
        await message.channel
          .bulkDelete(messagesToDelete, true)
          .then((deletedMessages) =>
            logInfo(
              `Deletadas ${deletedMessages.size} mensagens de spam do usuário ${message.author.tag} em ${message.channel.name}.`
            )
          )
          .catch((bulkDeleteError) => {
            logError(
              `Erro ao deletar mensagens de spam em massa (algumas podem ter mais de 14 dias):`,
              bulkDeleteError
            );
            messagesToDelete.forEach(async (msg) => {
              if (
                msg.deletable &&
                now - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000
              ) {
                try {
                  await msg.delete();
                } catch (e) {
                  logError(`Erro ao deletar mensagem individual de spam:`, e);
                }
              }
            });
          });
      }
    } catch (error) {
      logError(`Erro geral ao buscar/deletar mensagens de spam:`, error);
    }

    // Envia um aviso na DM do usuário se o aviso não foi enviado recentemente
    if (
      !spamWarningSent.has(userId) ||
      now - spamWarningSent.get(userId) > WARN_COOLDOWN_MS
    ) {
      try {
        const user = await message.author.fetch();
        const dmEmbed = new EmbedBuilder()
          .setColor(0xffa500)
          .setTitle("⚡ Aviso de Moderação: Spam Detectado")
          .setDescription(
            `Suas mensagens em **${message.guild.name}** estão sendo detectadas como spam e foram apagadas.`
          )
          .addFields({
            name: "Razão",
            value: `Você enviou ${userHistory.messages.length} mensagens em ${spamTimeWindowSeconds} segundos, excedendo o limite de ${spamMessageLimit}.`,
            inline: false,
          })
          .setTimestamp()
          .setFooter({
            text: "Por favor, evite enviar mensagens muito rapidamente.",
          });
        await user.send({ embeds: [dmEmbed] });
        spamWarningSent.set(userId, now);
        logInfo(`DM de aviso de spam enviada para ${user.tag}.`);
      } catch (dmError) {
        logWarn(
          `Não foi possível enviar DM de aviso de spam para ${message.author.tag} (${message.author.id}):`,
          dmError
        );
      }
    }

    // TIMEOUT
    if (userHistory.spamCount >= 3) {
      // Se o usuário spammar 3 ou mais vezes seguidas
      const member = message.guild.members.cache.get(userId);
      if (member) {
        try {
          const TIMEOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutos de timeout
          const TIMEOUT_REASON =
            "Spam excessivo após múltiplos avisos automáticos.";

          await member.timeout(TIMEOUT_DURATION_MS, TIMEOUT_REASON);
          logInfo(
            `Usuário ${member.user.tag} (${userId}) recebeu timeout de 5 minutos por spam excessivo.`
          );

          // Envia uma mensagem no canal para notificar
          await message.channel
            .send(
              `**${member.user.tag}** foi silenciado por 5 minutos devido a spam excessivo.`
            )
            .catch((e) =>
              logError(`Erro ao enviar mensagem de canal sobre timeout:`, e)
            );

          // log detalhado para o canal de automod
          if (automodLogChannelId) {
            try {
              const logChannel = await message.guild.channels
                .fetch(automodLogChannelId)
                .catch(() => null);
              if (logChannel && logChannel.type === ChannelType.GuildText) {
                const timeoutLogEmbed = new EmbedBuilder()
                  .setColor(0xdc143c)
                  .setTitle("🚫 Usuário Silenciado por Spam")
                  .setDescription(
                    `O usuário ${member.user.tag} foi automaticamente silenciado.`
                  )
                  .addFields(
                    {
                      name: "Usuário",
                      value: `<@${userId}> (${member.user.tag})`,
                      inline: true,
                    },
                    { name: "Duração", value: "5 minutos", inline: true },
                    { name: "Motivo", value: TIMEOUT_REASON, inline: false }
                  )
                  .setTimestamp()
                  .setFooter({ text: `ID do Usuário: ${userId}` });
                await logChannel.send({ embeds: [timeoutLogEmbed] });
              }
            } catch (logErr) {
              logError(
                `Erro ao enviar log de timeout para o canal de automoderação:`,
                logErr
              );
            }
          }
        } catch (timeoutError) {
          logError(
            `Erro ao aplicar timeout no usuário ${member.user.tag} (${userId}):`,
            timeoutError
          );
          await message.channel
            .send(
              `Erro ao tentar silenciar **${member.user.tag}**. Verifique as permissões do bot (Permissão "Moderar Membros").`
            )
            .catch((e) =>
              logError(
                `Erro ao enviar mensagem de erro de timeout no canal:`,
                e
              )
            );
        }
        userHistory.spamCount = 0;
        userMessageHistory.set(userId, userHistory);
      }
    }

    const logSentThreshold = 2 * spamTimeWindowSeconds * 1000;
    if (now - userHistory.lastSpamLogged > logSentThreshold) {
      if (automodLogChannelId) {
        try {
          const logChannel = await message.guild.channels
            .fetch(automodLogChannelId)
            .catch(() => null);
          if (logChannel && logChannel.type === ChannelType.GuildText) {
            const embed = new EmbedBuilder()
              .setColor(0xffa500)
              .setTitle("⚡ Auto-Moderação: Spam Detectado")
              .setDescription(
                `As mensagens de ${message.author.tag} foram detectadas como spam e apagadas.`
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
                  name: "Mensagens Enviadas (Detectadas)",
                  value: `${userHistory.messages.length} em ${spamTimeWindowSeconds} segundos`,
                  inline: false,
                }
              )
              .setTimestamp()
              .setFooter({ text: `ID do Usuário: ${message.author.id}` });

            await logChannel.send({ embeds: [embed] });
            userHistory.lastSpamLogged = now;
          } else {
            logWarn(
              `Canal de logs de automoderação (${automodLogChannelId}) inválido ou não é um canal de texto.`
            );
          }
        } catch (error) {
          logError(`Erro ao enviar log de auto-moderação (spam):`, error);
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
