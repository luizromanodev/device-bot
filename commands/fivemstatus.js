// commands/fivemstatus.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { logInfo, logWarn, logError } = require("../utils/logger");
require("dotenv").config(); // Para usar variáveis de ambiente

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fivemstatus")
    .setDescription("Mostra o status e informações do servidor FiveM."),
  async execute(interaction) {
    await interaction.deferReply(); // Deferir a resposta para evitar timeout

    const serverName = process.env.FIVEM_SERVER_NAME || "Sua Cidade RP"; // Nome da sua cidade/servidor
    const serverIP = process.env.FIVEM_SERVER_IP || "play.suacidade.com:30120"; // IP ou Domínio do seu servidor FiveM
    const serverWebsite =
      process.env.FIVEM_SERVER_WEBSITE || "https://suacidade.com/"; // Link do seu site/fórum (opcional)
    const serverDiscordInvite =
      process.env.FIVEM_DISCORD_INVITE || "https://discord.gg/seucidade"; // Link de convite do seu Discord (Opcional, se quiser outro)

    // --- Parte para Status Real-Time (Opcional - Requer API) ---
    // Para um status em tempo real, você precisaria de uma API que forneça isso.
    // Ex: https://docs.fivem.net/docs/server-manual/setting-up-a-server/server-commands/#get-info-of-your-server-via-http-request
    // fetch(`http://${serverIP}/info.json`)
    // fetch(`http://${serverIP}/players.json`)
    // Por enquanto, usaremos valores simulados ou fixos:
    let playerCount = Math.floor(Math.random() * (128 - 30 + 1)) + 30; // Simula 30-128 jogadores
    let serverStatus = "Online e Jogável ✅";

    // Se você tiver uma forma de verificar o status real, substitua as linhas acima.
    // Ex: Se você tiver um endpoint simples que retorna "online" ou "offline":
    // try {
    //   const response = await fetch(`http://SEU_IP_DA_API_DE_STATUS/status`);
    //   if (response.ok) {
    //     const data = await response.json();
    //     serverStatus = data.status === "online" ? "Online ✅" : "Offline 🔴";
    //     playerCount = data.players || "N/A"; // Se a API retornar jogadores
    //   } else {
    //     serverStatus = "Indisponível (Erro na API) ⚠️";
    //     playerCount = "N/A";
    //   }
    // } catch (fetchError) {
    //   logError(`Erro ao buscar status do FiveM para ${serverIP}:`, fetchError);
    //   serverStatus = "Offline (Erro de Conexão) 🔴";
    //   playerCount = "N/A";
    // }
    // -----------------------------------------------------------

    const statusEmbed = new EmbedBuilder()
      .setColor(serverStatus.includes("Online") ? 0x00ff00 : 0xff0000) // Verde se online, vermelho se offline
      .setTitle(`🚨 Status do Servidor ${serverName} 🚨`)
      .setDescription(`Informações atualizadas sobre a sua cidade no FiveM.`)
      .addFields(
        { name: "Estado do Servidor", value: serverStatus, inline: true },
        { name: "Jogadores Online", value: `${playerCount}`, inline: true },
        {
          name: "IP para Conexão",
          value: `\`connect ${serverIP}\``,
          inline: false,
        },
        { name: "Site Oficial", value: serverWebsite, inline: false },
        { name: "Discord", value: serverDiscordInvite, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `Solicitado por ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [statusEmbed] });
    logInfo(`Comando /fivemstatus usado por ${interaction.user.tag}.`);
  },
};
