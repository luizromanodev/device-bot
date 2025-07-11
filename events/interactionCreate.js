const {
  Events,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();

const { logInfo, logWarn, logError } = require("../utils/logger");

const { sendRatingRequest } = require("../utils/ticketManager");

const COUNTER_FILE = path.join(__dirname, "..", "counter.json");

async function getTicketCounter() {
  try {
    const data = await fs.promises.readFile(COUNTER_FILE, "utf8");
    const counter = JSON.parse(data);
    return counter.ticketCounter;
  } catch (error) {
    logError(`Erro ao ler counter.json, iniciando contador em 0:`, error);
    await saveTicketCounter(0);
    return 0;
  }
}

async function saveTicketCounter(count) {
  try {
    const data = JSON.stringify({ ticketCounter: count }, null, 2);
    await fs.promises.writeFile(COUNTER_FILE, data, "utf8");
  } catch (error) {
    logError(`Erro ao salvar counter.json:`, error);
  }
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const staffRoleId = process.env.STAFF_ROLE_ID;
    const isStaff =
      interaction.inGuild() && interaction.member.roles.cache.has(staffRoleId);

    // comandos de barra (/)
    if (interaction.isChatInputCommand()) {
      // --- comando /clear ---
      if (interaction.commandName === "clear") {
        if (!interaction.inGuild()) {
          return await interaction.reply({
            content: "Este comando só pode ser usado em um servidor.",
            flags: [MessageFlags.Ephemeral],
          });
        }

        if (
          !interaction.member.permissions.has(
            PermissionsBitField.Flags.ManageMessages
          )
        ) {
          return await interaction.reply({
            content: "Você não tem permissão para usar este comando.",
            flags: [MessageFlags.Ephemeral],
          });
        }

        const amount = interaction.options.getInteger("quantidade");
        const targetUser = interaction.options.getUser("usuario");
        const channel = interaction.channel;

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
          let messages;
          const fetchLimit = targetUser ? Math.min(amount * 2, 100) : amount;
          messages = await channel.messages.fetch({ limit: fetchLimit });

          if (targetUser) {
            messages = messages
              .filter((msg) => msg.author.id === targetUser.id)
              .first(amount);
          } else {
            messages = messages.first(amount);
          }

          if (messages.size === 0) {
            return await interaction.editReply({
              content:
                "Nenhuma mensagem encontrada para apagar com os critérios fornecidos.",
              flags: [MessageFlags.Ephemeral],
            });
          }

          const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
          const deletableMessages = messages.filter(
            (msg) => msg.createdTimestamp > twoWeeksAgo
          );

          if (deletableMessages.size === 0) {
            return await interaction.editReply({
              content:
                "Não foi possível apagar nenhuma mensagem, pois todas as mensagens encontradas têm mais de 14 dias.",
              flags: [MessageFlags.Ephemeral],
            });
          }

          let deletedCount = 0;
          try {
            const bulkDeleted = await channel.bulkDelete(
              deletableMessages,
              true
            );
            deletedCount = bulkDeleted.size;
            logInfo(
              `Comando /clear: BulkDelete apagou ${deletedCount} mensagens no canal ${
                channel.name
              }${targetUser ? ` de ${targetUser.tag}` : ""} por ${
                interaction.user.tag
              }.`
            );
          } catch (bulkDeleteError) {
            logError(
              `Erro ao usar bulkDelete no comando /clear, tentando individualmente:`,
              bulkDeleteError
            );
            for (const msg of deletableMessages.values()) {
              if (msg.deletable) {
                try {
                  await msg.delete();
                  deletedCount++;
                } catch (individualDeleteError) {
                  logError(
                    `Erro ao deletar mensagem individualmente no comando /clear (${msg.id}):`,
                    individualDeleteError
                  );
                }
              }
            }
            logWarn(
              `Comando /clear: BulkDelete falhou, ${deletedCount} mensagens deletadas individualmente no canal ${channel.name} por ${interaction.user.tag}.`
            );
          }

          const replyContent = targetUser
            ? `Apagadas **${deletedCount}** mensagens de **${targetUser.tag}**.`
            : `Apagadas **${deletedCount}** mensagens neste canal.`;
          await interaction.editReply({
            content: replyContent,
            ephemeral: false,
          });

          const AUTOMOD_LOG_CHANNEL_ID = process.env.AUTOMOD_LOG_CHANNEL_ID;
          if (AUTOMOD_LOG_CHANNEL_ID) {
            const logChannel = await interaction.guild.channels
              .fetch(AUTOMOD_LOG_CHANNEL_ID)
              .catch(() => null);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
              const logEmbed = new EmbedBuilder()
                .setColor(0x00bfff)
                .setTitle("🧹 Comando Clear Executado")
                .setDescription(
                  `O comando \`/clear\` foi usado por ${interaction.user.tag}.`
                )
                .addFields(
                  { name: "Canal", value: `<#${channel.id}>`, inline: true },
                  {
                    name: "Quantidade Solicitada",
                    value: `${amount}`,
                    inline: true,
                  },
                  {
                    name: "Usuário Alvo",
                    value: targetUser
                      ? `${targetUser.tag} (${targetUser.id})`
                      : "Todos",
                    inline: true,
                  },
                  {
                    name: "Mensagens Apagadas (Efetivo)",
                    value: `${deletedCount}`,
                    inline: true,
                  },
                  {
                    name: "Executor",
                    value: `${interaction.user.tag} (${interaction.user.id})`,
                    inline: true,
                  }
                )
                .setTimestamp();
              await logChannel.send({ embeds: [logEmbed] });
            } else {
              logWarn(
                `Canal de logs de automoderação (${AUTOMOD_LOG_CHANNEL_ID}) inválido ou não é um canal de texto para log do /clear.`
              );
            }
          }
        } catch (error) {
          logError(`Erro ao executar o comando /clear:`, error);
          await interaction.editReply({
            content:
              "Ocorreu um erro ao tentar apagar as mensagens. Verifique as permissões do bot.",
            flags: [MessageFlags.Ephemeral],
          });
        }
        return;
      }

      // comando /ban
      if (interaction.commandName === "ban") {
        if (!interaction.inGuild()) {
          return await interaction.reply({
            content: "Este comando só pode ser usado em um servidor.",
            flags: [MessageFlags.Ephemeral],
          });
        }
        const modal = new ModalBuilder()
          .setCustomId("ban_notification_modal")
          .setTitle("Notificar Banimento/Advertência");

        const nameInGameInput = new TextInputBuilder()
          .setCustomId("name_ingame_modal")
          .setLabel("Nome In-game da pessoa banida")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("Ex: JaoDoGrau");

        const discordUserOrIdInput = new TextInputBuilder()
          .setCustomId("discord_user_or_id_modal")
          .setLabel("Usuário Discord (@menção ou ID) (opcional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder("Ex: @JaoDoGrau ou 123456789012345678");

        const reasonInput = new TextInputBuilder()
          .setCustomId("reason_modal")
          .setLabel("Motivo do banimento")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder("Ex: RDM, zaralhando na cidade.");

        const consequenceInput = new TextInputBuilder()
          .setCustomId("consequence_modal")
          .setLabel("Consequência (Ban Permanente, 7 dias, etc.)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("Ex: Ban permanente");

        const adminInput = new TextInputBuilder()
          .setCustomId("admin_modal")
          .setLabel("Nome do Administrador (opcional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder("Ex: NomeDoAdmin");

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInGameInput),
          new ActionRowBuilder().addComponents(reasonInput),
          new ActionRowBuilder().addComponents(consequenceInput),
          new ActionRowBuilder().addComponents(discordUserOrIdInput),
          new ActionRowBuilder().addComponents(adminInput)
        );

        await interaction.showModal(modal);
        return;
      }
      // outros comandos de barra
      else {
        const command = interaction.client.commands.get(
          interaction.commandName
        );
        if (!command) {
          logError(
            `Nenhum comando correspondente a ${interaction.commandName} foi encontrado.`
          );
          return;
        }
        try {
          await command.execute(interaction);
        } catch (error) {
          logError(
            `Erro ao executar o comando ${interaction.commandName}`,
            error
          );
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: "Houve um erro ao executar este comando!",
              flags: [MessageFlags.Ephemeral],
            });
          } else {
            await interaction.reply({
              content: "Houve um erro ao executar este comando!",
              flags: [MessageFlags.Ephemeral],
            });
          }
        }
      }
    }
    // dropdowns
    else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "ticket_select") {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const ticketType = interaction.values[0];
        const guild = interaction.guild;
        const member = interaction.member;

        let targetCategoryId;
        switch (ticketType) {
          case "duvidas":
            targetCategoryId = process.env.CATEGORY_DUVIDAS_ID;
            break;
          case "doacao_loja":
            targetCategoryId = process.env.CATEGORY_DOACAO_LOJA_ID;
            break;
          case "denuncias":
            targetCategoryId = process.env.CATEGORY_DENUNCIAS_ID;
            break;
          case "organizacoes":
            targetCategoryId = process.env.CATEGORY_ORGANIZACOES_ID;
            break;
          case "streamers":
            targetCategoryId = process.env.CATEGORY_STREAMERS_ID;
            break;
          case "remover_banimento":
            targetCategoryId = process.env.CATEGORY_REMOVER_BANIMENTO_ID;
            break;
          case "outros":
            targetCategoryId = process.env.CATEGORY_OUTROS_ID;
            break;
          default:
            logError(`Tipo de ticket desconhecido: ${ticketType}`);
            await interaction.editReply({
              content:
                "Erro: Tipo de ticket inválido selecionado. Por favor, tente novamente.",
              flags: [MessageFlags.Ephemeral],
            });
            return;
        }

        const categoryExists = await guild.channels
          .fetch(targetCategoryId)
          .catch(() => null);
        if (
          !categoryExists ||
          categoryExists.type !== ChannelType.GuildCategory
        ) {
          logError(
            `Categoria ID inválida ou não encontrada para ${ticketType}: ${targetCategoryId}`
          );
          await interaction.editReply({
            content:
              "Erro: A categoria de destino para este tipo de ticket não foi configurada corretamente no bot. Por favor, contate a administração.",
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        const existingTicketChannel = guild.channels.cache.find((c) => {
          if (c.type !== ChannelType.GuildText || !c.topic) {
            return false;
          }
          try {
            const topicData = JSON.parse(c.topic);
            return (
              topicData.userId === member.id &&
              topicData.ticketType === ticketType
            );
          } catch (e) {
            return false;
          }
        });

        if (existingTicketChannel) {
          const formattedTicketType =
            ticketType.charAt(0).toUpperCase() +
            ticketType.slice(1).replace(/_/g, " ");
          await interaction.editReply({
            content: `Você já tem um ticket "${formattedTicketType}" aberto: ${existingTicketChannel}.`,
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        try {
          let ticketNumber = await getTicketCounter();
          ticketNumber++;
          await saveTicketCounter(ticketNumber);
          const formattedTicketNumber = String(ticketNumber).padStart(4, "0");

          const channelName = `${formattedTicketNumber}-${member.user.username
            .toLowerCase()
            .replace(/\s/g, "-")}-${ticketType}`;

          const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: targetCategoryId,
            topic: JSON.stringify({
              userId: member.id,
              ticketType: ticketType,
              ticketNumber: ticketNumber,
              createdAt: Date.now(),
              lastActivity: Date.now(),
              warningSent: false,
            }),
            permissionOverwrites: [
              {
                id: guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
              },
              {
                id: member.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                ],
              },
              {
                id: staffRoleId,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ManageChannels,
                ],
              },
            ],
          });

          const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("Atendimento")
            .setDescription(
              "Todos os responsáveis pelo ticket já foram informados, evite enviar mensagens diretas e aguarde, alguém em breve irá atendê-lo.\nDescreva o motivo do contato com o máximo de detalhes."
            )
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .addFields(
              {
                name: "Tipo de Ticket",
                value:
                  ticketType.charAt(0).toUpperCase() +
                  ticketType.slice(1).replace(/_/g, " "),
              },
              { name: "Usuário", value: `${member.user.tag}` },
              { name: "Número do Ticket", value: formattedTicketNumber }
            )
            .setFooter({
              text: "Lembre-se que os botões são exclusivos para staffs!",
            });

          const rowButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("close_ticket")
              .setLabel("Desejo sair ou cancelar esse ticket")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("claim_ticket")
              .setLabel("Assumir Atendimento")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("finalize_ticket")
              .setLabel("Finalizar Ticket")
              .setStyle(ButtonStyle.Success)
          );

          const staffRowButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("call_member")
              .setLabel("Chamar Membro")
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId("add_member")
              .setLabel("Adicionar Membro")
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId("remove_member")
              .setLabel("Remover Membro")
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId("move_ticket")
              .setLabel("Mover Ticket")
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId("create_call")
              .setLabel("Criar Call")
              .setStyle(ButtonStyle.Primary)
          );

          await ticketChannel.send({
            content: `<@${member.id}> <@&${staffRoleId}>`,
            embeds: [embed],
            components: [rowButtons, staffRowButtons],
          });

          await interaction.editReply({
            content: `Seu ticket #${formattedTicketNumber} foi aberto em ${ticketChannel}.`,
            flags: [MessageFlags.Ephemeral],
          });
        } catch (error) {
          logError(`Erro ao criar o canal do ticket:`, error);
          await interaction.editReply({
            content:
              "Houve um erro ao abrir seu ticket. Tente novamente mais tarde.",
            flags: [MessageFlags.Ephemeral],
          });
        }
      }
    }
    // interações de botão
    else if (interaction.isButton()) {
      switch (interaction.customId) {
        case "close_ticket":
          let openerIdClose = null;
          try {
            openerIdClose = JSON.parse(
              interaction.channel.topic || "{}"
            ).userId;
          } catch (e) {
            logWarn(
              `Erro ao parsear tópico do canal ao fechar ticket: ${e.message}`
            );
          }

          if (interaction.member.id === openerIdClose) {
            await interaction.reply({
              content: "Fechando o ticket em 5 segundos...",
              ephemeral: false,
            });
            setTimeout(async () => {
              await interaction.channel.delete();
            }, 5000);
          } else {
            await interaction.reply({
              content:
                "Você não tem permissão para fechar este ticket. Apenas o criador do ticket pode usar este botão.",
              flags: [MessageFlags.Ephemeral],
            });
          }
          break;

        case "claim_ticket":
          if (isStaff) {
            const modal = new ModalBuilder()
              .setCustomId("claim_ticket_modal")
              .setTitle("Assumir Atendimento do Ticket");

            const initialMessageInput = new TextInputBuilder()
              .setCustomId("initial_message")
              .setLabel("Mensagem inicial para o usuário (opcional)")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setPlaceholder(
                "Ex: Olá! Como posso ajudar? Estou analisando seu caso."
              );

            const firstActionRow = new ActionRowBuilder().addComponents(
              initialMessageInput
            );
            modal.addComponents(firstActionRow);
            await interaction.showModal(modal);
          } else {
            await interaction.reply({
              content: "Você não tem permissão para assumir este ticket.",
              flags: [MessageFlags.Ephemeral],
            });
          }
          break;

        case "finalize_ticket":
          if (isStaff) {
            const modal = new ModalBuilder()
              .setCustomId("finalize_ticket_modal")
              .setTitle("Finalizar Ticket");

            const reasonInput = new TextInputBuilder()
              .setCustomId("finalization_reason")
              .setLabel("Motivo da Finalização")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder("Ex: Problema resolvido; Inatividade; Abuso.");

            const descriptionInput = new TextInputBuilder()
              .setCustomId("finalization_description")
              .setLabel("Descrição Adicional (opcional)")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setPlaceholder(
                "Ex: O usuário foi orientado a reabrir se o problema persistir."
              );

            const row1 = new ActionRowBuilder().addComponents(reasonInput);
            const row2 = new ActionRowBuilder().addComponents(descriptionInput);
            modal.addComponents(row1, row2);

            await interaction.showModal(modal);
          } else {
            await interaction.reply({
              content: "Você não tem permissão para finalizar este ticket.",
              flags: [MessageFlags.Ephemeral],
            });
          }
          break;

        case "call_member":
          if (isStaff) {
            const modal = new ModalBuilder()
              .setCustomId("call_member_modal")
              .setTitle("Chamar Membro (DM)");

            const memberIdInput = new TextInputBuilder()
              .setCustomId("member_id")
              .setLabel("ID do Membro a ser chamado")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder("Ex: 123456789012345678");

            const dmTitleInput = new TextInputBuilder()
              .setCustomId("dm_title")
              .setLabel("Título da Mensagem Privada (DM)")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setPlaceholder("Ex: Chamado para Suporte - Ticket #XYZ");

            const dmDescriptionInput = new TextInputBuilder()
              .setCustomId("dm_description")
              .setLabel("Conteúdo da Mensagem Privada (DM)")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setPlaceholder(
                "Ex: Olá! Sua presença é solicitada no ticket de suporte. Clique aqui para ir:"
              );

            const firstRow = new ActionRowBuilder().addComponents(
              memberIdInput
            );
            const secondRow = new ActionRowBuilder().addComponents(
              dmTitleInput
            );
            const thirdRow = new ActionRowBuilder().addComponents(
              dmDescriptionInput
            );
            modal.addComponents(firstRow, secondRow, thirdRow);
            await interaction.showModal(modal);
          } else {
            await interaction.reply({
              content: "Você não tem permissão para usar este botão.",
              flags: [MessageFlags.Ephemeral],
            });
          }
          break;

        case "add_member":
          if (isStaff) {
            const modal = new ModalBuilder()
              .setCustomId("add_member_modal")
              .setTitle("Adicionar Membro ao Ticket");

            const memberIdInput = new TextInputBuilder()
              .setCustomId("member_id")
              .setLabel("ID do Membro a ser adicionado")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder("Ex: 123456789012345678");

            const firstRow = new ActionRowBuilder().addComponents(
              memberIdInput
            );
            modal.addComponents(firstRow);
            await interaction.showModal(modal);
          } else {
            await interaction.reply({
              content: "Você não tem permissão para usar este botão.",
              flags: [MessageFlags.Ephemeral],
            });
          }
          break;

        case "remove_member":
          if (isStaff) {
            const modal = new ModalBuilder()
              .setCustomId("remove_member_modal")
              .setTitle("Remover Membro do Ticket");

            const memberIdInput = new TextInputBuilder()
              .setCustomId("member_id")
              .setLabel("ID do Membro a ser removido")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder("Ex: 123456789012345678");

            const firstRow = new ActionRowBuilder().addComponents(
              memberIdInput
            );
            modal.addComponents(firstRow);
            await interaction.showModal(modal);
          } else {
            await interaction.reply({
              content: "Você não tem permissão para usar este botão.",
              flags: [MessageFlags.Ephemeral],
            });
          }
          break;

        case "move_ticket":
          if (isStaff) {
            const modal = new ModalBuilder()
              .setCustomId("move_ticket_modal")
              .setTitle("Mover Ticket para Outra Categoria");

            const categoryIdInput = new TextInputBuilder()
              .setCustomId("category_id")
              .setLabel("ID da Categoria de Destino")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder("Ex: 123456789012345678 (ID da categoria)");

            const firstRow = new ActionRowBuilder().addComponents(
              categoryIdInput
            );
            modal.addComponents(firstRow);
            await interaction.showModal(modal);
          } else {
            await interaction.reply({
              content: "Você não tem permissão para usar este botão.",
              flags: [MessageFlags.Ephemeral],
            });
          }
          break;

        case "create_call":
          if (!isStaff) {
            return interaction.reply({
              content:
                "Você não tem permissão para criar uma call para este ticket.",
              flags: [MessageFlags.Ephemeral],
            });
          }

          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

          try {
            const currentChannel = interaction.channel;
            const guild = interaction.guild;
            const staffRole = await guild.roles
              .fetch(staffRoleId)
              .catch(() => null);
            const member = interaction.member;

            let ticketOpenerId = null;
            let ticketNumber = "N/A";
            try {
              const topicData = JSON.parse(currentChannel.topic || "{}");
              ticketOpenerId = topicData.userId;
              ticketNumber = String(topicData.ticketNumber || "N/A").padStart(
                4,
                "0"
              );
              ticketType = topicData.ticketType || "N/A";
            } catch (e) {
              logError(`Erro ao parsear tópico do canal ao criar call:`, e);
            }

            const permissionOverwritesForCall = [];

            permissionOverwritesForCall.push({
              id: guild.id, // @everyone
              deny: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
              ],
            });

            if (ticketOpenerId) {
              permissionOverwritesForCall.push({
                id: ticketOpenerId,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.Connect,
                  PermissionsBitField.Flags.Speak,
                ],
              });
            }

            if (staffRole) {
              permissionOverwritesForCall.push({
                id: staffRole.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.Connect,
                  PermissionsBitField.Flags.Speak,
                ],
              });
            }

            for (const [id, overwrite] of currentChannel.permissionOverwrites
              .cache) {
              if (
                id !== guild.id &&
                id !== staffRoleId &&
                id !== ticketOpenerId
              ) {
                const target = await guild.members.fetch(id).catch(() => null);
                if (target) {
                  permissionOverwritesForCall.push({
                    id: id,
                    allow: [
                      PermissionsBitField.Flags.ViewChannel,
                      PermissionsBitField.Flags.Connect,
                      PermissionsBitField.Flags.Speak,
                    ],
                  });
                }
              }
            }

            const voiceChannelName = `📞chamada-${ticketNumber}-${member.user.username
              .toLowerCase()
              .replace(/\s/g, "-")}`;
            const voiceChannel = await guild.channels.create({
              name: voiceChannelName,
              type: ChannelType.GuildVoice,
              parent: currentChannel.parentId,
              permissionOverwrites: permissionOverwritesForCall,
            });

            const callEmbed = new EmbedBuilder()
              .setColor(0x3498db)
              .setTitle("Chamada de Voz Criada!")
              .setDescription(
                `Uma chamada de voz foi criada para este ticket. Clique no botão abaixo para entrar.`
              )
              .addFields(
                {
                  name: "Canal de Voz",
                  value: `<#${voiceChannel.id}>`,
                  inline: true,
                },
                {
                  name: "Criado por",
                  value: interaction.member.user.tag,
                  inline: true,
                }
              )
              .setTimestamp()
              .setFooter({
                text: "A call será acessível apenas aos participantes deste ticket e à staff.",
              });

            const callButtonRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setURL(voiceChannel.url)
                .setLabel("Entrar na Call")
                .setStyle(ButtonStyle.Link),
              new ButtonBuilder()
                .setCustomId(`delete_call_${voiceChannel.id}`)
                .setLabel("Deletar Call")
                .setStyle(ButtonStyle.Danger)
            );

            await currentChannel.send({
              content: `<@${member.id}> <@&${staffRoleId}>`,
              embeds: [callEmbed],
              components: [callButtonRow],
            });

            await interaction.editReply({
              content: `Call "${voiceChannel.name}" criada com sucesso em <#${voiceChannel.id}>!`,
              flags: [MessageFlags.Ephemeral],
            });
          } catch (error) {
            logError(`Erro ao criar a call para o ticket:`, error);
            await interaction.editReply({
              content:
                "Houve um erro ao criar a call. Verifique as permissões do bot ou tente novamente.",
              flags: [MessageFlags.Ephemeral],
            });
          }
          break;
      }

      if (interaction.customId.startsWith("delete_call_")) {
        if (!isStaff) {
          return interaction.reply({
            content: "Você não tem permissão para deletar esta call.",
            flags: [MessageFlags.Ephemeral],
          });
        }
        const voiceChannelIdToDelete = interaction.customId.split("_")[2];
        const voiceChannelToDelete = interaction.guild.channels.cache.get(
          voiceChannelIdToDelete
        );

        if (
          voiceChannelToDelete &&
          voiceChannelToDelete.type === ChannelType.GuildVoice
        ) {
          try {
            await interaction.deferUpdate();
            await interaction.followUp({
              content: `Call <#${voiceChannelIdToDelete}> deletada com sucesso!`,
              flags: [MessageFlags.Ephemeral],
            });
          } catch (error) {
            logError(`Erro ao deletar call:`, error);
            await interaction.followUp({
              content:
                "Houve um erro ao deletar a call. Verifique as permissões do bot.",
              flags: [MessageFlags.Ephemeral],
            });
          }
        } else {
          await interaction.reply({
            content: "Não foi possível encontrar a call para deletar.",
            flags: [MessageFlags.Ephemeral],
          });
        }
      } else if (interaction.customId.startsWith("rate_ticket_")) {
        logInfo(
          `Botão de avaliação clicado! Custom ID: ${interaction.customId}`
        );
        await interaction.deferUpdate();

        try {
          const parts = interaction.customId.split("_");
          if (
            parts.length !== 6 ||
            parts[0] !== "rate" ||
            parts[1] !== "ticket"
          ) {
            logError(
              `Custom ID de avaliação inválido ou mal formatado: ${interaction.customId}`
            );
            await interaction.followUp({
              content:
                "Erro: ID de avaliação inválido. Por favor, contate a administração.",
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          const ticketNumber = parts[2];
          const userId = parts[3];
          const ticketChannelId = parts[4];
          const rating = parseInt(parts[5]);

          if (isNaN(rating) || rating < 1 || rating > 5) {
            logError(
              `Avaliação inválida no Custom ID: ${interaction.customId}. Rating: ${rating}`
            );
            await interaction.followUp({
              content: "Erro: Avaliação inválida. Por favor, tente novamente.",
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          if (interaction.user.id !== userId) {
            await interaction.followUp({
              content:
                "Você não pode avaliar este ticket. Apenas o criador original pode.",
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          const RATING_LOG_CHANNEL_ID =
            process.env.TICKET_RATING_LOG_CHANNEL_ID;
          if (!RATING_LOG_CHANNEL_ID) {
            logError(
              `TICKET_RATING_LOG_CHANNEL_ID não configurado no .env! Avaliações não serão logadas.`
            );
            await interaction.followUp({
              content:
                "Erro: Canal de logs de avaliação não está configurado. A avaliação foi registrada, mas não pode ser logada.",
              flags: [MessageFlags.Ephemeral],
            });
          } else {
            try {
              const ratingLogChannel = await interaction.client.channels
                .fetch(RATING_LOG_CHANNEL_ID)
                .catch(() => null);
              if (
                !ratingLogChannel ||
                ratingLogChannel.type !== ChannelType.GuildText
              ) {
                logError(
                  `Canal de logs de avaliação (${RATING_LOG_CHANNEL_ID}) inválido ou não é um canal de texto.`
                );
                await interaction.followUp({
                  content:
                    "Erro: Canal de logs de avaliação é inválido. A avaliação foi registrada, mas não pode ser logada.",
                  flags: [MessageFlags.Ephemeral],
                });
              } else {
                const ratingLogEmbed = new EmbedBuilder()
                  .setColor(0x00ff00)
                  .setTitle(`⭐ Nova Avaliação de Ticket #${ticketNumber}`)
                  .setDescription(
                    `O usuário <@${userId}> (${interaction.user.tag}) avaliou o atendimento do ticket.`
                  )
                  .addFields(
                    {
                      name: "Ticket Original",
                      value: `<#${ticketChannelId}> (ID: \`${ticketChannelId}\`)`,
                      inline: false,
                    },
                    {
                      name: "Avaliação",
                      value: `${"⭐".repeat(rating)} (${rating}/5)`,
                      inline: true,
                    },
                    {
                      name: "Avaliado por",
                      value: `${interaction.user.tag} (ID: \`${interaction.user.id}\`)`,
                      inline: true,
                    }
                  )
                  .setTimestamp()
                  .setFooter({
                    text: `Avaliado em DM | Ticket #${ticketNumber}`,
                  });

                await ratingLogChannel.send({ embeds: [ratingLogEmbed] });
                logInfo(
                  `Avaliação de ticket #${ticketNumber} (${rating} estrelas) logada.`
                );
              }
            } catch (logChannelError) {
              logError(
                `Erro ao enviar log de avaliação para o canal de logs:`,
                logChannelError
              );
            }
          }

          const updatedRow = ActionRowBuilder.from(
            interaction.message.components[0]
          );
          for (const button of updatedRow.components) {
            button.setDisabled(true);
          }

          const dmChannel = await interaction.user.createDM().catch((e) => {
            logError(
              `Erro ao criar DM com o usuário ${interaction.user.tag} para desabilitar botões na avaliação:`,
              e
            );
            return null;
          });

          if (dmChannel) {
            const originalRatingMessage = await dmChannel.messages
              .fetch(interaction.message.id)
              .catch((e) => {
                logError(
                  `Erro ao buscar mensagem de avaliação na DM do usuário (${interaction.user.id}) para edição:`,
                  e
                );
                return null;
              });

            if (originalRatingMessage) {
              await originalRatingMessage
                .edit({ components: [updatedRow] })
                .catch((editErr) => {
                  logError(
                    `Erro ao editar mensagem de avaliação na DM do usuário (${interaction.user.id}):`,
                    editErr
                  );
                });
            } else {
              logWarn(
                `Mensagem original de avaliação não encontrada na DM do usuário ${interaction.user.tag} (${interaction.user.id}).`
              );
            }
          } else {
            logWarn(
              `Não foi possível enviar/editar a DM de avaliação para ${interaction.user.tag} (DM desativada ou outro erro).`
            );
          }

          await interaction.followUp({
            content: `✅ Obrigado por avaliar seu ticket #${ticketNumber} com ${rating} estrelas!`,
            flags: [MessageFlags.Ephemeral],
          });
        } catch (generalError) {
          logError(`ERRO GERAL ao processar botão de avaliação:`, generalError);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content:
                "Ocorreu um erro ao registrar sua avaliação. Por favor, tente novamente mais tarde.",
              flags: [MessageFlags.Ephemeral],
            });
          } else {
            await interaction.reply({
              content:
                "Ocorreu um erro ao registrar sua avaliação. Por favor, tente novamente.",
              flags: [MessageFlags.Ephemeral],
            });
          }
        }
      }
    } else if (interaction.isModalSubmit()) {
      const isStaff = interaction.member.roles.cache.has(
        process.env.STAFF_ROLE_ID
      );

      if (interaction.customId === "claim_ticket_modal") {
        const initialMessage =
          interaction.fields.getTextInputValue("initial_message");
        const staffMember = interaction.member;
        const currentChannel = interaction.channel;

        let ticketOpenerId = null;
        let ticketNumber = "N/A";
        try {
          const topicData = JSON.parse(currentChannel.topic || "{}");
          ticketOpenerId = topicData.userId;
          ticketNumber = String(topicData.ticketNumber || "N/A").padStart(
            4,
            "0"
          );
          ticketType = topicData.ticketType || "N/A";
        } catch (e) {
          logError(`Erro ao parsear tópico do canal ao assumir ticket:`, e);
        }

        const claimedEmbed = new EmbedBuilder()
          .setColor(0x32cd32)
          .setTitle("Atendimento Assumido!")
          .setDescription(
            `Este ticket agora está sendo atendido por: ${staffMember.user.tag}`
          )
          .setThumbnail(staffMember.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: "Por favor, aguarde o atendimento." });

        if (initialMessage) {
          claimedEmbed.addFields({
            name: "Mensagem Inicial do Staff",
            value: initialMessage,
          });
        } else {
          claimedEmbed.addFields({
            name: "Mensagem Inicial do Staff",
            value: "Olá! Agradecemos sua paciência. Estamos aqui para ajudar.",
          });
        }

        await interaction.channel.send({ embeds: [claimedEmbed] });
        await interaction.reply({
          content: "Atendimento assumido com sucesso!",
          flags: [MessageFlags.Ephemeral],
        });

        if (ticketOpenerId) {
          try {
            const ticketOpener = await interaction.client.users
              .fetch(ticketOpenerId)
              .catch(() => null);
            if (ticketOpener) {
              const dmToOpenerEmbed = new EmbedBuilder()
                .setColor(0x00ff7f)
                .setTitle(`Seu Ticket #${ticketNumber} Foi Assumido!`)
                .setDescription(
                  `Olá! Seu ticket em **${interaction.guild.name}** foi assumido por um de nossos staffs.`
                )
                .addFields(
                  {
                    name: "Assumido por",
                    value: staffMember.user.tag,
                    inline: true,
                  },
                  {
                    name: "Seu Ticket",
                    value: `<#${currentChannel.id}>`,
                    inline: true,
                  },
                  {
                    name: "Mensagem do Staff",
                    value:
                      initialMessage ||
                      "O staff assumiu seu atendimento e estará com você em breve.",
                  }
                )
                .setTimestamp()
                .setFooter({
                  text: "Aguarde mais informações no canal do ticket.",
                });

              await ticketOpener.send({ embeds: [dmToOpenerEmbed] });
              logInfo(
                `DM de atendimento assumido enviada para ${ticketOpener.tag}.`
              );
            }
          } catch (error) {
            logError(
              `Erro ao enviar DM de atendimento assumido para o usuário (${ticketOpenerId}):`,
              error
            );
            if (error.code === 50007) {
              await currentChannel.send(
                `⚠️ **Atenção:** Não foi possível enviar uma DM para o criador do ticket (<@${ticketOpenerId}>), pois ele pode ter DMs desativadas.`
              );
            } else {
              await currentChannel.send(
                `⚠️ **Atenção:** O ticket foi finalizado, mas houve um erro ao enviar a DM de notificação para o criador do ticket.`
              );
            }
          }
        }
      } else if (interaction.customId === "call_member_modal") {
        const memberId = interaction.fields.getTextInputValue("member_id");
        const dmTitle = interaction.fields.getTextInputValue("dm_title");
        const dmDescription =
          interaction.fields.getTextInputValue("dm_description");
        const currentChannel = interaction.channel;
        const staffMember = interaction.member;

        try {
          const targetMember = await interaction.guild.members
            .fetch(memberId)
            .catch(() => null);
          if (!targetMember) {
            await interaction.reply({
              content: "Membro não encontrado no servidor.",
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          const dmEmbed = new EmbedBuilder()
            .setColor(0x00bfff)
            .setTitle(dmTitle)
            .setDescription(dmDescription)
            .addFields(
              { name: "Servidor", value: interaction.guild.name, inline: true },
              {
                name: "Chamado por",
                value: staffMember.user.tag,
                inline: true,
              },
              {
                name: "Ticket Referente",
                value: `<#${currentChannel.id}>`,
                inline: false,
              }
            )
            .setTimestamp()
            .setFooter({ text: "Por favor, verifique o ticket de suporte." });

          await targetMember.send({ embeds: [dmEmbed] });

          await currentChannel.send(
            `Uma mensagem privada foi enviada para ${targetMember.user.tag} (${targetMember.id}) chamando-o para este ticket.`
          );
          await interaction.reply({
            content: `Mensagem privada enviada para ${targetMember.user.tag} com sucesso!`,
            flags: [MessageFlags.Ephemeral],
          });
        } catch (error) {
          logError(`Erro ao chamar membro via DM:`, error);
          if (error.code === 50007) {
            await interaction.reply({
              content: `Não foi possível enviar a mensagem privada para ${
                targetMember
                  ? targetMember.user.tag
                  : "o usuário com o ID fornecido"
              }. Eles podem ter DMs desativadas.`,
              flags: [MessageFlags.Ephemeral],
            });
          } else {
            await interaction.reply({
              content: `⚠️ Erro ao enviar a DM de notificação para ${
                targetMember
                  ? targetMember.user.tag
                  : "o usuário com o ID fornecido"
              }.`,
              flags: [MessageFlags.Ephemeral],
            });
          }
        }
      } else if (interaction.customId === "add_member_modal") {
        const memberId = interaction.fields.getTextInputValue("member_id");
        const currentChannel = interaction.channel;

        try {
          const targetMember = await interaction.guild.members
            .fetch(memberId)
            .catch(() => null);
          if (!targetMember) {
            return interaction.reply({
              content: "Membro não encontrado no servidor.",
              flags: [MessageFlags.Ephemeral],
            });
          }

          await currentChannel.permissionOverwrites.edit(targetMember, {
            ViewChannel: true,
            SendMessages: true,
          });

          await currentChannel.send(
            `Membro ${targetMember.user.tag} foi adicionado ao ticket por ${interaction.member}.`
          );
          await interaction.reply({
            content: `Membro ${targetMember.user.tag} adicionado com sucesso!`,
            flags: [MessageFlags.Ephemeral],
          });
        } catch (error) {
          logError(`Erro ao adicionar membro:`, error);
          await interaction.reply({
            content:
              "Não foi possível adicionar o membro. Verifique o ID ou permissões do bot.",
            flags: [MessageFlags.Ephemeral],
          });
        }
      } else if (interaction.customId === "remove_member_modal") {
        const memberId = interaction.fields.getTextInputValue("member_id");
        const currentChannel = interaction.channel;
        let ticketOpenerId = null;

        try {
          const topicData = JSON.parse(currentChannel.topic || "{}");
          ticketOpenerId = topicData.userId;
        } catch (e) {
          logWarn(
            `Erro ao parsear tópico do canal ao remover membro: ${e.message}`
          );
        }

        try {
          const targetMember = await interaction.guild.members
            .fetch(memberId)
            .catch(() => null);
          if (!targetMember) {
            return interaction.reply({
              content: "Membro não encontrado no servidor.",
              flags: [MessageFlags.Ephemeral],
            });
          }

          if (targetMember.id === ticketOpenerId && !isStaff) {
            return interaction.reply({
              content: "Você não pode remover o criador do ticket.",
              flags: [MessageFlags.Ephemeral],
            });
          }

          await currentChannel.permissionOverwrites.delete(targetMember);

          await currentChannel.send(
            `Membro ${targetMember.user.tag} foi removido do ticket por ${interaction.member}.`
          );
          await interaction.reply({
            content: `Membro ${targetMember.user.tag} removido com sucesso!`,
            flags: [MessageFlags.Ephemeral],
          });
        } catch (error) {
          logError(`Erro ao remover membro:`, error);
          await interaction.reply({
            content:
              "Não foi possível remover o membro. Verifique o ID ou permissões do bot.",
            flags: [MessageFlags.Ephemeral],
          });
        }
      } else if (interaction.customId === "move_ticket_modal") {
        const newCategoryId =
          interaction.fields.getTextInputValue("category_id");
        const currentChannel = interaction.channel;

        try {
          const targetCategory = await interaction.guild.channels
            .fetch(newCategoryId)
            .catch(() => null);

          if (
            !targetCategory ||
            targetCategory.type !== ChannelType.GuildCategory
          ) {
            return interaction.reply({
              content: "ID da categoria inválido ou não é uma categoria.",
              flags: [MessageFlags.Ephemeral],
            });
          }

          await currentChannel.setParent(newCategoryId, {
            lockPermissions: false,
          });
          await currentChannel.send(
            `Ticket movido para a categoria: <#${newCategoryId}> por ${interaction.member}.`
          );
          await interaction.reply({
            content: `Ticket movido para a categoria ${targetCategory.name} com sucesso!`,
            flags: [MessageFlags.Ephemeral],
          });
        } catch (error) {
          logError(`Erro ao mover ticket:`, error);
          await interaction.reply({
            content:
              "Não foi possível mover o ticket. Verifique o ID da categoria ou permissões do bot.",
            flags: [MessageFlags.Ephemeral],
          });
        }
      } else if (interaction.customId === "finalize_ticket_modal") {
        try {
          const finalizationReason = interaction.fields.getTextInputValue(
            "finalization_reason"
          );
          const finalizationDescription = interaction.fields.getTextInputValue(
            "finalization_description"
          );
          const staffMember = interaction.member;
          const currentChannel = interaction.channel;

          let ticketOpenerId = null;
          let ticketNumber = "N/A";
          let ticketType = "N/A";
          try {
            const topicData = JSON.parse(currentChannel.topic || "{}");
            ticketOpenerId = topicData.userId;
            ticketNumber = String(topicData.ticketNumber || "N/A").padStart(
              4,
              "0"
            );
            ticketType = topicData.ticketType || "N/A";
          } catch (e) {
            logError(`Erro ao parsear tópico do canal ao finalizar ticket:`, e);
            await interaction.reply({
              content:
                "Erro interno: Não foi possível ler os dados do ticket. O ticket pode ter sido criado antes das atualizações.",
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

          const TICKET_LOGS_CHANNEL_ID = process.env.TICKET_LOGS_CHANNEL_ID;
          logInfo(
            `Verificando TICKET_LOGS_CHANNEL_ID: ${TICKET_LOGS_CHANNEL_ID}`
          );

          if (!TICKET_LOGS_CHANNEL_ID) {
            logError(
              `ERRO CRÍTICO: TICKET_LOGS_CHANNEL_ID não configurado no .env! Não é possível gerar logs.`
            );
            await interaction.followUp({
              content:
                "Erro: O canal de logs de tickets não está configurado. Por favor, avise um administrador.",
              flags: [MessageFlags.Ephemeral],
            });
          } else {
            try {
              logInfo(
                `Tentando buscar mensagens do canal ${currentChannel.id}...`
              );
              const messages = await currentChannel.messages.fetch({
                limit: 100,
              });
              const sortedMessages = messages.sort(
                (a, b) => a.createdTimestamp - b.createdTimestamp
              );
              logInfo(`${sortedMessages.size} mensagens encontradas.`);

              let transcriptContent = `--- Transcrição do Ticket #${ticketNumber} (${ticketType}) ---\n`;
              transcriptContent += `Canal: #${currentChannel.name}\n`;
              transcriptContent += `Criado por: ${
                ticketOpenerId
                  ? (
                      await interaction.client.users
                        .fetch(ticketOpenerId)
                        .catch(() => ({
                          tag: "Desconhecido",
                          id: ticketOpenerId,
                        }))
                    ).tag
                  : "Desconhecido"
              }\n`;
              transcriptContent += `Finalizado por: ${staffMember.user.tag}\n`;
              transcriptContent += `Motivo da Finalização: ${finalizationReason}\n`;
              if (finalizationDescription) {
                transcriptContent += `Descrição Adicional: ${finalizationDescription}\n`;
              }
              transcriptContent += `Data de Finalização: ${new Date().toLocaleString(
                "pt-BR",
                { timeZone: "America/Sao_Paulo" }
              )}\n`;
              transcriptContent += `------------------------------------------------------\n\n`;

              for (const message of sortedMessages.values()) {
                const timestamp = message.createdAt.toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                });
                const author = message.author.tag;
                const content = message.content || "[Mensagem sem texto]";
                const attachments = message.attachments
                  .map((att) => att.url)
                  .join("\n");

                transcriptContent += `[${timestamp}] ${author}: ${content}\n`;
                if (attachments) {
                  transcriptContent += `[Anexos]:\n${attachments}\n`;
                }
                transcriptContent += `\n`;
              }
              logInfo(`Conteúdo da transcrição formatado.`);

              const fileName = `ticket-${ticketNumber}-${currentChannel.name}.txt`;
              const transcriptsDir = path.join(__dirname, "..", "transcripts");
              const filePath = path.join(transcriptsDir, fileName);

              if (!fs.existsSync(transcriptsDir)) {
                logInfo(
                  `Pasta 'transcripts' não existe. Tentando criar: ${transcriptsDir}`
                );
                try {
                  fs.mkdirSync(transcriptsDir, { recursive: true });
                  logInfo(`Pasta 'transcripts' criada com sucesso.`);
                } catch (dirError) {
                  logError(
                    `ERRO: Não foi possível criar o diretório de transcrições ${transcriptsDir}:`,
                    dirError
                  );
                  await interaction.followUp({
                    content:
                      "Erro: Não foi possível criar a pasta para salvar transcrições. Verifique as permissões do bot no sistema.",
                    flags: [MessageFlags.Ephemeral],
                  });
                }
              } else {
                logInfo(`Pasta 'transcripts' já existe: ${transcriptsDir}`);
              }

              logInfo(`Tentando escrever arquivo de transcrição: ${filePath}`);
              await fs.promises.writeFile(filePath, transcriptContent, "utf8");
              logInfo(`Arquivo de transcrição escrito com sucesso.`);

              const logsChannel = await interaction.guild.channels
                .fetch(TICKET_LOGS_CHANNEL_ID)
                .catch(() => null);
              if (logsChannel && logsChannel.type === ChannelType.GuildText) {
                logInfo(`Tentando enviar transcrição para o Discord.`);
                const logEmbed = new EmbedBuilder()
                  .setColor(0x008080)
                  .setTitle(`📝 Transcrição do Ticket #${ticketNumber}`)
                  .setDescription(
                    `O ticket \`${currentChannel.name}\` foi finalizado e a transcrição está em anexo.`
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
                      name: "Finalizado por",
                      value: staffMember.user.tag,
                      inline: true,
                    },
                    { name: "Motivo", value: finalizationReason, inline: false }
                  )
                  .setTimestamp();

                await logsChannel.send({
                  embeds: [logEmbed],
                  files: [{ attachment: filePath, name: fileName }],
                });
                logInfo(
                  `Transcrição do ticket #${ticketNumber} enviada para o canal de logs.`
                );
              } else {
                logError(
                  `ERRO: Canal de logs de tickets (${TICKET_LOGS_CHANNEL_ID}) não encontrado ou não é um canal de texto válido. Não foi possível enviar a transcrição para o Discord.`
                );
                await interaction.followUp({
                  content:
                    "A transcrição foi gerada, mas não foi possível enviá-la para o canal de logs (canal inválido).",
                  flags: [MessageFlags.Ephemeral],
                });
              }

              fs.unlink(filePath, (err) => {
                if (err)
                  logError(
                    `Erro ao deletar ficheiro de transcrição local:`,
                    err
                  );
                else logInfo(`Ficheiro de transcrição local deletado.`);
              });
            } catch (transcriptError) {
              logError(
                `ERRO GERAL no processo de transcrição do ticket:`,
                transcriptError
              );
              await interaction.followUp({
                content:
                  "Houve um erro ao gerar a transcrição do ticket. Por favor, verifique os logs do bot.",
                flags: [MessageFlags.Ephemeral],
              });
            }
          }

          if (ticketOpenerId) {
            await sendRatingRequest(
              interaction.client,
              ticketOpenerId,
              ticketNumber,
              interaction.guild.name,
              currentChannel.name,
              currentChannel.id
            );
          } else {
            logWarn(
              `Não foi possível enviar solicitação de avaliação: Criador do ticket não identificado.`
            );
          }

          await currentChannel.send("Este canal será fechado em 5 segundos...");
          await interaction.editReply({
            content:
              "Ticket finalizado com sucesso! O canal será fechado em breve.",
            flags: [MessageFlags.Ephemeral],
          });
          setTimeout(async () => {
            await currentChannel.delete();
          }, 5000);
        } catch (generalError) {
          logError(`Erro inesperado ao finalizar ticket:`, generalError);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content:
                "Ocorreu um erro ao finalizar o ticket. Por favor, tente novamente.",
              flags: [MessageFlags.Ephemeral],
            });
          } else {
            await interaction.editReply({
              content:
                "Ocorreu um erro ao finalizar o ticket. Por favor, tente novamente.",
              flags: [MessageFlags.Ephemeral],
            });
          }
        }
      } else if (interaction.customId === "ban_notification_modal") {
        try {
          logInfo(`Tentando deferir a resposta do modal de banimento...`);
          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
          logInfo(`Resposta do modal de banimento deferida.`);

          const nameInGame =
            interaction.fields.getTextInputValue("name_ingame_modal");
          const discordUserOrId = interaction.fields.getTextInputValue(
            "discord_user_or_id_modal"
          );
          const reason = interaction.fields.getTextInputValue("reason_modal");
          const consequence =
            interaction.fields.getTextInputValue("consequence_modal");
          const adminName =
            interaction.fields.getTextInputValue("admin_modal") ||
            "Não informado";

          const banLogChannelId = process.env.BAN_LOG_CHANNEL_ID;
          if (!banLogChannelId) {
            await interaction.editReply({
              content:
                "Erro: Canal de logs de banimento não configurado (BAN_LOG_CHANNEL_ID no .env).",
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          const banLogChannel = await interaction.guild.channels
            .fetch(banLogChannelId)
            .catch(() => null);
          if (!banLogChannel || banLogChannel.type !== ChannelType.GuildText) {
            await interaction.editReply({
              content:
                "Erro: Canal de logs de banimento inválido ou não é um canal de texto.",
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          let targetDiscordUser = null;
          let discordMentionValue = "Não informado";

          if (discordUserOrId) {
            const discordIdMatch = discordUserOrId.match(/\d+/);
            const extractedId = discordIdMatch ? discordIdMatch[0] : null;

            if (extractedId) {
              try {
                targetDiscordUser = await interaction.client.users
                  .fetch(extractedId)
                  .catch(() => null);
                discordMentionValue = `<@${extractedId}> (${
                  targetDiscordUser
                    ? targetDiscordUser.tag
                    : "Usuário desconhecido"
                })`;
              } catch (fetchError) {
                logError(
                  `Erro ao buscar usuário pelo ID/menção manual (${extractedId}):`,
                  fetchError
                );
                discordMentionValue = `ID: ${extractedId} (Usuário não encontrado)`;
              }
            } else {
              discordMentionValue = `Texto digitado: "${discordUserOrId}" (Não é menção ou ID válido)`;
            }
          }

          const embed = new EmbedBuilder()
            .setColor(0xcd0000)
            .setTitle("🚨 Notificação de Banimento/Advertência FiveM 🚨")
            .addFields(
              { name: "Nome In-game", value: nameInGame, inline: false },
              { name: "Discord", value: discordMentionValue, inline: false },
              { name: "Motivo", value: reason, inline: false },
              { name: "Consequência", value: consequence, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Administrador: ${adminName}` });

          await banLogChannel.send({ embeds: [embed] });
          await interaction.editReply({
            content:
              "Notificação de banimento enviada com sucesso para o canal de logs!",
            flags: [MessageFlags.Ephemeral],
          });

          if (targetDiscordUser) {
            try {
              const dmEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("🚨 Notificação de Banimento/Advertência 🚨")
                .setDescription(
                  `Você recebeu uma notificação de banimento/advertência no servidor **${interaction.guild.name}** referente à cidade FiveM.`
                )
                .addFields(
                  { name: "Nome In-game", value: nameInGame, inline: false },
                  { name: "Motivo", value: reason, inline: false },
                  { name: "Consequência", value: consequence, inline: false },
                  { name: "Administrador", value: adminName, inline: false }
                )
                .setTimestamp()
                .setFooter({
                  text: "Se tiver dúvidas, entre em contato com a administração.",
                });

              await targetDiscordUser.send({ embeds: [dmEmbed] });
              await interaction.followUp({
                content: `✅ Notificação de banimento enviada via DM para ${targetDiscordUser.tag}.`,
                flags: [MessageFlags.Ephemeral],
              });
            } catch (dmError) {
              logError(
                `Erro ao enviar DM de banimento para ${targetDiscordUser.tag}:`,
                dmError
              );
              if (dmError.code === 50007) {
                await interaction.followUp({
                  content: `⚠️ Não foi possível enviar a DM de notificação para ${targetDiscordUser.tag} (provavelmente DMs desativadas).`,
                  flags: [MessageFlags.Ephemeral],
                });
              } else {
                await interaction.followUp({
                  content: `⚠️ Erro ao enviar a DM de notificação para ${targetDiscordUser.tag}.`,
                  flags: [MessageFlags.Ephemeral],
                });
              }
            }
          }
        } catch (generalError) {
          logError(
            `Erro inesperado ao processar modal de banimento:`,
            generalError
          );
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content:
                "Ocorreu um erro ao processar seu formulário de banimento. Por favor, tente novamente.",
              flags: [MessageFlags.Ephemeral],
            });
          } else {
            await interaction.editReply({
              content:
                "Ocorreu um erro ao processar seu formulário de banimento. Por favor, tente novamente.",
              flags: [MessageFlags.Ephemeral],
            });
          }
        }
      }
    }
  },
};
