const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  MessageFlags,
} = require("discord.js");
const { logInfo, logError, logWarn } = require("../utils/logger");
require("dotenv").config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("report-player")
    .setDescription(
      "Envia um relatório de comportamento indevido de um jogador no FiveM."
    ),
  async execute(interaction) {
    const serverName = process.env.FIVEM_SERVER_NAME || "Sua Cidade RP";
    const reportLogChannelId = process.env.FIVEM_REPORT_LOG_CHANNEL_ID;
    const staffRoleId = process.env.STAFF_ROLE_ID;

    if (!reportLogChannelId) {
      logError(
        "FIVEM_REPORT_LOG_CHANNEL_ID não está configurado no arquivo .env."
      );
      return await interaction.reply({
        content:
          "O canal de logs de relatórios não foi configurado no bot. Por favor, contate a administração.",
        flags: [MessageFlags.Ephemeral],
      });
    }
    if (!staffRoleId) {
      logWarn(
        "STAFF_ROLE_ID não está configurado no arquivo .env. Staff não será mencionada nos relatórios."
      );
    }

    const modal = new ModalBuilder()
      .setCustomId("reportPlayerModal")
      .setTitle(`Reportar Jogador - ${serverName}`);

    const reportedPlayerNameInput = new TextInputBuilder()
      .setCustomId("reportedPlayerName")
      .setLabel("Nome/ID do Jogador Reportado (FiveM)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Ex: JaoDoGrau (ID: 123) / 76561198000000000")
      .setRequired(true)
      .setMaxLength(100);

    const reasonInput = new TextInputBuilder()
      .setCustomId("reportReason")
      .setLabel("Motivo do Relatório (Detalhes)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(
        "Descreva o ocorrido, quebra de regras, metagaming, RDM, etc. Com o máximo de detalhes!"
      )
      .setRequired(true)
      .setMinLength(50)
      .setMaxLength(2000);

    const proofLinkInput = new TextInputBuilder()
      .setCustomId("proofLink")
      .setLabel("Link da Prova (Vídeo/Screenshot - Opcional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(
        "Ex: https://youtube.com/seu_canal0 / https://prnt.sc/abcde"
      )
      .setRequired(false)
      .setMaxLength(500);

    const yourDiscordInput = new TextInputBuilder()
      .setCustomId("yourDiscordId")
      .setLabel("Seu Discord (Opcional, para contato staff)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(
        "Ex: @SeuNomeDeUsuario (ou deixe vazio para usar seu nome atual)"
      )
      .setRequired(false)
      .setValue(interaction.user.tag)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder().addComponents(reportedPlayerNameInput),
      new ActionRowBuilder().addComponents(reasonInput),
      new ActionRowBuilder().addComponents(proofLinkInput),
      new ActionRowBuilder().addComponents(yourDiscordInput)
    );

    await interaction.showModal(modal);

    const filter = (modalInteraction) =>
      modalInteraction.customId === "reportPlayerModal" &&
      modalInteraction.user.id === interaction.user.id;
    try {
      const modalSubmit = await interaction.awaitModalSubmit({
        filter,
        time: 600000,
      }); // 10 minutos para submeter

      const reportedPlayerName =
        modalSubmit.fields.getTextInputValue("reportedPlayerName");
      const reportReason = modalSubmit.fields.getTextInputValue("reportReason");
      let proofLink = modalSubmit.fields.getTextInputValue("proofLink");
      const reporterDiscord =
        modalSubmit.fields.getTextInputValue("yourDiscordId") ||
        modalSubmit.user.tag;

      const reportLogChannel = await modalSubmit.client.channels
        .fetch(reportLogChannelId)
        .catch(() => null);

      if (
        !reportLogChannel ||
        reportLogChannel.type !== ChannelType.GuildText
      ) {
        logError(
          `Canal de logs de relatórios com ID ${reportLogChannelId} não encontrado ou não é um canal de texto.`
        );
        return await modalSubmit.reply({
          content:
            "Ocorreu um erro ao enviar seu relatório. O canal de logs não foi encontrado ou não é um canal de texto válido. Por favor, contate a administração.",
          flags: [MessageFlags.Ephemeral],
        });
      }

      let formattedProofLink = "Nenhuma prova fornecida.";
      if (proofLink) {
        try {
          new URL(proofLink);
          formattedProofLink = proofLink;
        } catch (e) {
          logWarn(
            `Link de prova inválido fornecido no relatório por ${modalSubmit.user.tag}: ${proofLink}`
          );
          formattedProofLink = `Link inválido: \`${proofLink}\` (Verificar manualmente)`;
        }
      }

      const reportEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`🚨 NOVO RELATÓRIO DE JOGADOR - ${reportedPlayerName}`)
        .setDescription(`Um jogador foi reportado em ${serverName}.`)
        .addFields(
          {
            name: "👤 Jogador Reportado",
            value: reportedPlayerName,
            inline: true,
          },
          {
            name: "Reporter (Discord)",
            value: `<@${modalSubmit.user.id}> (${reporterDiscord})`,
            inline: true,
          },
          { name: "📜 Motivo", value: reportReason, inline: false },
          { name: "🔗 Prova", value: formattedProofLink, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `Relatório ID: ${modalSubmit.id}` });

      let mentionContent = "";
      if (staffRoleId) {
        mentionContent = `<@&${staffRoleId}>`;
      } else {
        mentionContent = "⚠️ Cargo de staff não configurado para menção.";
      }

      await reportLogChannel.send({
        content: mentionContent,
        embeds: [reportEmbed],
      });

      await modalSubmit.reply({
        content:
          "✅ Seu relatório foi enviado com sucesso! A equipe de moderação irá analisá-lo. Agradecemos sua ajuda para manter o RP justo.",
        flags: [MessageFlags.Ephemeral],
      });
      logInfo(
        `Relatório de jogador enviado por ${modalSubmit.user.tag} sobre ${reportedPlayerName}.`
      );
    } catch (error) {
      if (error.code === "InteractionCollectorError") {
        await interaction.followUp({
          content:
            "Você demorou muito para enviar o relatório. Tente novamente.",
          flags: [MessageFlags.Ephemeral],
        });
      } else {
        logError(
          `Erro ao processar submissão do modal de relatório de jogador:`,
          error
        );
        await interaction.followUp({
          content:
            "Ocorreu um erro inesperado ao enviar seu relatório. Por favor, tente novamente mais tarde.",
          flags: [MessageFlags.Ephemeral],
        });
      }
    }
  },
};
