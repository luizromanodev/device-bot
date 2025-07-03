const {
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();

const COUNTER_FILE = path.join(__dirname, "..", "counter.json");

async function getTicketCounter() {
  try {
    const data = await fs.promises.readFile(COUNTER_FILE, "utf8");
    const counter = JSON.parse(data);
    return counter.ticketCounter;
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}] Erro ao ler counter.json (ticketManager):`,
      error.message
    );
    await saveTicketCounter(0);
    return 0;
  }
}

async function saveTicketCounter(count) {
  try {
    const data = JSON.stringify({ ticketCounter: count }, null, 2);
    await fs.promises.writeFile(COUNTER_FILE, data, "utf8");
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}] Erro ao salvar counter.json (ticketManager):`,
      error.message
    );
  }
}

// Função para atualizar o timestamp de atividade do ticket
async function updateTicketActivity(channel) {
  if (!channel || channel.type !== ChannelType.GuildText || !channel.topic)
    return;

  try {
    const topicData = JSON.parse(channel.topic);
    // Atualiza lastActivity apenas se for um ticket gerido pelo bot e não estiver arquivado/fechado
    if (
      topicData.userId &&
      topicData.ticketType &&
      topicData.ticketNumber &&
      !topicData.archived
    ) {
      topicData.lastActivity = Date.now();
      topicData.warningSent = false;
      await channel.setTopic(JSON.stringify(topicData));
    }
  } catch (e) {}
}

// --- OBJETO ticketManager QUE CONTÉM AS FUNÇÕES EXPORTADAS ---
const ticketManager = {
  updateTicketActivity: updateTicketActivity,
  checkInactiveTickets: async function (client) {
    // Implementação da função de auto-fechamento
    const WARN_HOURS = parseInt(
      process.env.TICKET_INACTIVITY_WARN_HOURS || "20",
      10
    );
    const CLOSE_HOURS = parseInt(
      process.env.TICKET_INACTIVITY_CLOSE_HOURS || "24",
      10
    );
    const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
    const TICKET_LOGS_CHANNEL_ID = process.env.TICKET_LOGS_CHANNEL_ID;

    if (!STAFF_ROLE_ID || !TICKET_LOGS_CHANNEL_ID) {
      console.error(
        `[${new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })}] Erro de configuração para auto-fechamento: STAFF_ROLE_ID ou TICKET_LOGS_CHANNEL_ID não definidos.`
      );
      return;
    }

    for (const guild of client.guilds.cache.values()) {
      const staffRole = await guild.roles
        .fetch(STAFF_ROLE_ID)
        .catch(() => null);
      if (!staffRole) {
        console.error(
          `[${new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}] Cargo da staff (${STAFF_ROLE_ID}) não encontrado na guilda ${
            guild.name
          }.`
        );
        continue;
      }

      const logsChannel = await guild.channels
        .fetch(TICKET_LOGS_CHANNEL_ID)
        .catch(() => null);
      if (!logsChannel || logsChannel.type !== ChannelType.GuildText) {
        console.error(
          `[${new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}] Canal de logs (${TICKET_LOGS_CHANNEL_ID}) não encontrado ou não é um canal de texto na guilda ${
            guild.name
          }.`
        );
      }

      for (const channel of guild.channels.cache.values()) {
        if (channel.type !== ChannelType.GuildText || !channel.topic) continue;

        let topicData;
        try {
          topicData = JSON.parse(channel.topic);
        } catch (e) {
          continue;
        }

        // Verifica se é um canal de ticket gerenciado pelo bot e não é um ticket já arquivado/fechado
        if (
          topicData.userId &&
          topicData.ticketType &&
          topicData.ticketNumber &&
          !topicData.archived
        ) {
          const lastActivityTime =
            topicData.lastActivity || topicData.createdAt;
          const inactivityDurationHours =
            (Date.now() - lastActivityTime) / (1000 * 60 * 60);

          const ticketNumber = String(topicData.ticketNumber || "N/A").padStart(
            4,
            "0"
          );
          const ticketOpenerId = topicData.userId;

          // Caso 1: Fechar por Inatividade
          if (inactivityDurationHours >= CLOSE_HOURS) {
            console.log(
              `[${new Date().toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}] Fechando ticket #${ticketNumber} (${
                channel.name
              }) por inatividade (${inactivityDurationHours.toFixed(2)} horas).`
            );

            try {
              const finalizationReason = `Fechado automaticamente por inatividade (${CLOSE_HOURS} horas).`;
              const finalizationDescription = `Não houve atividade neste ticket por mais de ${CLOSE_HOURS} horas.`;
              const staffBotUser = client.user; // O próprio bot é o "staff" que finaliza

              // Lógica de Transcrição para auto-fechamento
              if (logsChannel) {
                // Verifica se o canal de logs é válido antes de tentar enviar
                try {
                  const messages = await channel.messages.fetch({ limit: 100 });
                  const sortedMessages = messages.sort(
                    (a, b) => a.createdTimestamp - b.createdTimestamp
                  );
                  let transcriptContent = `--- Transcrição do Ticket #${ticketNumber} (AUTO-FECHADO) ---\n`;
                  transcriptContent += `Canal: #${channel.name}\n`;
                  transcriptContent += `Criado por: ${
                    ticketOpenerId
                      ? (
                          await client.users
                            .fetch(ticketOpenerId)
                            .catch(() => ({
                              tag: "Desconhecido",
                              id: ticketOpenerId,
                            }))
                        ).tag
                      : "Desconhecido"
                  }\n`;
                  transcriptContent += `Finalizado por: ${staffBotUser.tag}\n`;
                  transcriptContent += `Motivo da Finalização: ${finalizationReason}\n`;
                  transcriptContent += `Data de Finalização: ${new Date().toLocaleString(
                    "pt-BR",
                    { timeZone: "America/Sao_Paulo" }
                  )}\n`;
                  transcriptContent += `------------------------------------------------------\n\n`;

                  for (const message of sortedMessages.values()) {
                    const timestamp = message.createdAt.toLocaleString(
                      "pt-BR",
                      { timeZone: "America/Sao_Paulo" }
                    );
                    const author = message.author.tag;
                    const content = message.content || "[Mensagem sem texto]";
                    const attachments = message.attachments
                      .map((att) => att.url)
                      .join("\n");
                    transcriptContent += `[${timestamp}] ${author}: ${content}\n`;
                    if (attachments)
                      transcriptContent += `[Anexos]:\n${attachments}\n`;
                    transcriptContent += `\n`;
                  }

                  const fileName = `ticket-${ticketNumber}-${channel.name}-auto-closed.txt`;
                  const transcriptsDir = path.join(
                    __dirname,
                    "..",
                    "transcripts"
                  );
                  const filePath = path.join(transcriptsDir, fileName);

                  if (!fs.existsSync(transcriptsDir)) {
                    fs.mkdirSync(transcriptsDir, { recursive: true });
                  }
                  await fs.promises.writeFile(
                    filePath,
                    transcriptContent,
                    "utf8"
                  );

                  const logEmbed = new EmbedBuilder()
                    .setColor(0x8b0000)
                    .setTitle(`🚫 Ticket #${ticketNumber} Auto-Fechado`)
                    .setDescription(
                      `O ticket \`${channel.name}\` foi fechado automaticamente por inatividade.`
                    )
                    .addFields(
                      {
                        name: "Criado por",
                        value: ticketOpenerId
                          ? `<@${ticketOpenerId}>`
                          : "Desconhecido",
                        inline: true,
                      },
                      {
                        name: "Fechado por",
                        value: staffBotUser.tag,
                        inline: true,
                      },
                      {
                        name: "Motivo",
                        value: finalizationReason,
                        inline: false,
                      }
                    )
                    .setTimestamp();
                  await logsChannel.send({
                    embeds: [logEmbed],
                    files: [{ attachment: filePath, name: fileName }],
                  });

                  fs.unlink(filePath, (err) => {
                    if (err)
                      console.error(
                        `[${new Date().toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })}] Erro ao deletar ficheiro de transcrição local (auto-close):`,
                        err
                      );
                  });
                } catch (transcriptError) {
                  console.error(
                    `[${new Date().toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}] Erro ao gerar transcrição para ticket auto-fechado #${ticketNumber}:`,
                    transcriptError
                  );
                }
              }

              // Enviar DM ao criador do ticket
              if (ticketOpenerId) {
                try {
                  const ticketOpener = await client.users.fetch(ticketOpenerId);
                  if (ticketOpener) {
                    const dmEmbed = new EmbedBuilder()
                      .setColor(0xff4500)
                      .setTitle(
                        `🚫 Seu Ticket #${ticketNumber} Foi Fechado Automaticamente`
                      )
                      .setDescription(
                        `Seu ticket em **${guild.name}** foi fechado devido a inatividade prolongada.`
                      )
                      .addFields(
                        {
                          name: "Motivo",
                          value: finalizationReason,
                          inline: false,
                        },
                        {
                          name: "Detalhes",
                          value: finalizationDescription,
                          inline: false,
                        }
                      )
                      .setTimestamp()
                      .setFooter({
                        text: "Se precisar de mais ajuda, abra um novo ticket.",
                      });
                    await ticketOpener.send({ embeds: [dmEmbed] });
                  }
                } catch (dmError) {
                  console.error(
                    `[${new Date().toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}] Erro ao enviar DM de auto-fechamento para o usuário (${ticketOpenerId}):`,
                    dmError
                  );
                }
              }

              await channel.send(
                `🚫 Este ticket foi fechado automaticamente por inatividade (${CLOSE_HOURS} horas sem atividade).`
              );
              await channel.delete("Ticket fechado por inatividade.");
            } catch (closeError) {
              console.error(
                `[${new Date().toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}] Erro ao fechar ticket #${ticketNumber} automaticamente:`,
                closeError
              );
            }
          }
          // Caso 2: Enviar Aviso de Inatividade
          else if (
            inactivityDurationHours >= WARN_HOURS &&
            !topicData.warningSent
          ) {
            console.log(
              `[${new Date().toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}] Enviando aviso de inatividade para ticket #${ticketNumber} (${inactivityDurationHours.toFixed(
                2
              )} horas).`
            );
            try {
              const warnEmbed = new EmbedBuilder()
                .setColor(0xffff00)
                .setTitle("⏰ Aviso de Inatividade no Ticket")
                .setDescription(
                  `Este ticket está inativo há mais de ${WARN_HOURS} horas.`
                )
                .addFields({
                  name: "Ação Necessária",
                  value:
                    "Por favor, responda a este ticket em até " +
                    (CLOSE_HOURS - WARN_HOURS) +
                    " horas, ou ele será fechado automaticamente.",
                  inline: false,
                })
                .setTimestamp()
                .setFooter({
                  text: "Se o problema já foi resolvido, o staff pode finalizá-lo.",
                });

              await channel.send({
                content: `<@${ticketOpenerId}> <@&${STAFF_ROLE_ID}>`,
                embeds: [warnEmbed],
              });

              topicData.warningSent = true;
              await channel.setTopic(JSON.stringify(topicData));
            } catch (warnError) {
              console.error(
                `[${new Date().toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}] Erro ao enviar aviso de inatividade para ticket #${ticketNumber}:`,
                warnError
              );
            }
          }
        }
      }
    }
  },
};
module.exports = ticketManager;
