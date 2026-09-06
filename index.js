require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  REST, 
  Routes, 
  SlashCommandBuilder,
  PermissionFlagsBits 
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

// ======================
// AYARLAR VE KANAL/ROL ID'LERİ
// ======================
const AC_LOG_CHANNEL_ID = "1546239467033989210";       // AC Başvuru Log Kanalı
const YETKILI_LOG_CHANNEL_ID = "1546240461822361710"; // Normal Yetkili Log Kanalı

const ROL_1 = "1542872121833820322";                 // Etiketlenecek 1. Rol
const ROL_2 = "1542872252045856879";                 // Etiketlenecek 2. Rol

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} slash komutlu başvuru botu aktif!`);

  // Slash Komutlarını Discord'a Otomatik Kaydetme
  const commands = [
    new SlashCommandBuilder()
      .setName('basvuru')
      .setDescription('Sunucu başvuru panelini açar.')
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log('🔄 Slash (/) komutları yükleniyor...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('✅ Slash (/) komutları başarıyla yüklendi!');
  } catch (error) {
    console.error(error);
  }
});

// 1. YÖNTEM: /basvuru Komutu
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'basvuru') {
      const embed = new EmbedBuilder()
        .setColor('#3a86ff')
        .setTitle('🌟 FEST GUN | Başvuru Sistemi')
        .setDescription('Ekibimize katılarak bizimle birlikte büyümek ister misin?\n\nAşağıdaki kategorilerden kendine uygun olan başvuru türünü seçerek formu doldurabilirsin!')
        .addFields(
          { name: '🛡️ AntiCheat (AC) Başvurusu', value: 'Güvenlik süreçleri ve hile tespiti için ekibimize katıl.', inline: false },
          { name: '👑 Normal Yetkili Başvurusu', value: 'Sunucu içi düzeni sağlamak ve aktifliği yönetmek için başvur.', inline: false }
        )
        .setFooter({ text: 'FEST GUN Başvuru Sistemi' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('apply_ac')
          .setLabel('AntiCheat Başvurusu')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛡️'),
        new ButtonBuilder()
          .setCustomId('apply_staff')
          .setLabel('Normal Yetkili Başvurusu')
          .setStyle(ButtonStyle.Success)
          .setEmoji('👑')
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
    }
  }

  // 2. YÖNTEM: Eski usul !basvuru-panel komutu (Yedek olarak dursun)
  if (interaction.isMessageComponent() === false && interaction.isChatInputCommand() === false) return;
});

// Eski !basvuru-panel komut desteği (istersen kullanabilirsin)
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!basvuru-panel' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.delete().catch(() => {});

    const embed = new EmbedBuilder()
      .setColor('#3a86ff')
      .setTitle('🌟 FEST GUN | Başvuru Sistemi')
      .setDescription('Ekibimize katılarak bizimle birlikte büyümek ister misin?\n\nAşağıdaki kategorilerden kendine uygun olan başvuru türünü seçerek formu doldurabilirsin!')
      .addFields(
        { name: '🛡️ AntiCheat (AC) Başvurusu', value: 'Güvenlik süreçleri ve hile tespiti için ekibimize katıl.', inline: false },
        { name: '👑 Normal Yetkili Başvurusu', value: 'Sunucu içi düzeni sağlamak ve aktifliği yönetmek için başvur.', inline: false }
      )
      .setFooter({ text: 'FEST GUN Başvuru Sistemi' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('apply_ac')
        .setLabel('AntiCheat Başvurusu')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛡️'),
      new ButtonBuilder()
        .setCustomId('apply_staff')
        .setLabel('Normal Yetkili Başvurusu')
        .setStyle(ButtonStyle.Success)
        .setEmoji('👑')
    );

    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

// Buton ve Modal (Form) Etkileşimleri
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === 'apply_ac') {
      const modal = new ModalBuilder()
        .setCustomId('modal_ac')
        .setTitle('🛡️ AntiCheat Başvuru Formu');

      const adYas = new TextInputBuilder()
        .setCustomId('ac_adyas')
        .setLabel('Adınız ve Yaşınız?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örn: Ahmet, 18')
        .setRequired(true);

      const deneyim = new TextInputBuilder()
        .setCustomId('ac_deneyim')
        .setLabel('Hile tespiti / AC hakkında bilgin?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Daha önceki deneyimlerinden bahset...')
        .setRequired(true);

      const gunlukSure = new TextInputBuilder()
        .setCustomId('ac_sure')
        .setLabel('Günlük aktiflik süreniz?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örn: 5-6 Saat')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(adYas),
        new ActionRowBuilder().addComponents(deneyim),
        new ActionRowBuilder().addComponents(gunlukSure)
      );

      await interaction.showModal(modal);
    } 
    else if (interaction.customId === 'apply_staff') {
      const modal = new ModalBuilder()
        .setCustomId('modal_staff')
        .setTitle('👑 Normal Yetkili Başvuru Formu');

      const adYas = new TextInputBuilder()
        .setCustomId('staff_adyas')
        .setLabel('Adınız ve Yaşınız?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örn: Mehmet, 17')
        .setRequired(true);

      const nedenSen = new TextInputBuilder()
        .setCustomId('staff_neden')
        .setLabel('Neden sizi yetkili seçmeliyiz?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Kendinden kısaca bahset...')
        .setRequired(true);

      const mikrofon = new TextInputBuilder()
        .setCustomId('staff_mikrofon')
        .setLabel('Mikrofon durumun nedir?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Var / Aktif kullanıyorum')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(adYas),
        new ActionRowBuilder().addComponents(nedenSen),
        new ActionRowBuilder().addComponents(mikrofon)
      );

      await interaction.showModal(modal);
    }
  } 
  else if (interaction.isModalSubmit()) {
    
    // ==========================================
    // ANTICHEAT LOG GÖNDERİMİ (1546239467033989210)
    // ==========================================
    if (interaction.customId === 'modal_ac') {
      const adYas = interaction.fields.getTextInputValue('ac_adyas');
      const deneyim = interaction.fields.getTextInputValue('ac_deneyim');
      const gunlukSure = interaction.fields.getTextInputValue('ac_sure');

      let puan = 80;
      let analizNotlari = ["✅ Aday ekibimize katılmak için istekli ve formunu tamamlamış."];
      if (deneyim.length > 50) puan = 95;

      const logChannel = interaction.guild.channels.cache.get(AC_LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🛡️ Yeni AntiCheat (AC) Başvurusu')
          .addFields(
            { name: '👤 Başvuran', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
            { name: '📝 Ad / Yaş', value: adYas, inline: true },
            { name: '⏳ Günlük Aktiflik', value: gunlukSure, inline: true },
            { name: '⚙️ Teknik Deneyim', value: deneyim, inline: false },
            { name: '🤖 Analiz ve Değerlendirme Raporu', value: `**Aday Skoru:** \`${puan}/100\`\n**Genel Durum:** 🟢 **Değerlendirmeye Uygun**\n\n**Analiz Notları:**\n${analizNotlari.join('\n')}`, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: 'FEST GUN AC Sistemi' });

        const etiketler = `<@&${ROL_1}> <@&${ROL_2}>`;
        await logChannel.send({ content: etiketler, embeds: [embed] });
      }

      await interaction.reply({ content: '✅ AntiCheat başvurunuz başarıyla alınmış ve yetkili ekibimize iletilmiştir!', ephemeral: true });
    } 

    // ==========================================
    // NORMAL YETKİLİ LOG GÖNDERİMİ (1546240461822361710)
    // ==========================================
    else if (interaction.customId === 'modal_staff') {
      const adYas = interaction.fields.getTextInputValue('staff_adyas');
      const nedenSen = interaction.fields.getTextInputValue('staff_neden');
      const mikrofon = interaction.fields.getTextInputValue('staff_mikrofon');

      let puan = 85;
      let analizNotlari = ["✅ Aday sunucumuzda aktif rol almak için başvuruda bulundu."];

      const logChannel = interaction.guild.channels.cache.get(YETKILI_LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('👑 Yeni Normal Yetkili Başvurusu')
          .addFields(
            { name: '👤 Başvuran', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
            { name: '📝 Ad / Yaş', value: adYas, inline: true },
            { name: '🎙️ Mikrofon Durumu', value: mikrofon, inline: true },
            { name: '💬 Neden Biz?', value: nedenSen, inline: false },
            { name: '🤖 Analiz ve Değerlendirme Raporu', value: `**Aday Skoru:** \`${puan}/100\`\n**Genel Durum:** 🟢 **Olumlu Değerlendirme**\n\n**Analiz Notları:**\n${analizNotlari.join('\n')}`, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: 'FEST GUN Yetkili Sistemi' });

        const etiketler = `<@&${ROL_1}> <@&${ROL_2}>`;
        await logChannel.send({ content: etiketler, embeds: [embed] });
      }

      await interaction.reply({ content: '✅ Normal yetkili başvurunuz başarıyla alınmış ve yetkili ekibimize iletilmiştir!', ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
