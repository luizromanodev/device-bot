// commands/infos.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { logInfo } = require("../utils/logger");
require("dotenv").config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("infos")
    .setDescription("Exibe informações importantes sobre a cidade FiveM."),
  async execute(interaction) {
    const serverName = process.env.FIVEM_SERVER_NAME || "Sua Cidade RP";

    const infosEmbed = new EmbedBuilder()
      .setColor(0x8a2be2) // Roxo
      .setTitle(`ℹ️ Informações Essenciais de ${serverName} ℹ️`)
      .setDescription(
        `Bem-vindo(a) à ${serverName}! Aqui estão alguns pontos importantes para você começar e entender o funcionamento da nossa cidade.`
      )
      .addFields(
        {
          name: "Como Entrar na Cidade?",
          value:
            "1. Certifique-se de ter o FiveM instalado.\n" +
            "2. Abra o FiveM e pressione `F8` para abrir o console.\n" +
            `3. Digite \`connect ${
              process.env.FIVEM_SERVER_IP || "play.suacidade.com:30120"
            }\` e pressione Enter.\n` +
            "4. Se for whitelist, certifique-se de ter sua whitelist aprovada!",
          inline: false,
        },
        {
          name: "Sistema de Economia",
          value:
            "Nossa cidade possui uma economia realista. Você pode trabalhar em empregos legais, montar seu próprio negócio ou seguir uma vida no crime. Cada ação tem suas consequências!",
          inline: false,
        },
        {
          name: "Whitelists (Opcional)",
          value:
            "Se você pretende atuar em uma profissão séria (Polícia, SAMU, etc.) ou em alguma organização específica, é provável que precise passar por um processo de whitelist. Verifique o canal de anúncios para mais detalhes.",
          inline: false,
        },
        {
          name: "Comunicação e Suporte",
          value:
            "Utilize o chat de voz para o RP e o Discord para comunicação fora do RP. Em caso de dúvidas ou problemas, abra um ticket em nosso sistema.",
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({
        text: `Explore e divirta-se em ${serverName} | Solicitado por ${interaction.user.tag}`,
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [infosEmbed] });
    logInfo(`Comando /infos usado por ${interaction.user.tag}.`);
  },
};
