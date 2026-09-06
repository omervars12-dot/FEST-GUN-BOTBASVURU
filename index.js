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

const { 
  joinVoiceChannel, 
  VoiceConnectionStatus, 
  entersState 
} = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
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

const TARGET_VOICE_CHANNEL_ID = "1542872463870922814"; // 7/24 Duracağı Ses Kanalı ID'si
const TARGET_IMAGE = "https://cdn.discordapp.com/attachments/1542872935809814688/1543803508547915786/ChatGPT_Image_31_Agu_2026_05_01_30.png?ex=6a9ec44e&is=6a9d72ce&hm=1a1a3cd5515ea1d43d8d89a44c16ff71702398ef3da14e341032e7c8144ecc37&"; 

// 7/24 Ses Kanalında Kalma Fonksiyonu
async function connectToVoice(guild) {
  const channel = guild.channels.cache.get(TARGET_VOICE_CHANNEL_ID);
  if (!channel) {
    return console.log(`❌ 7/24 Durulacak ses kanalı (${TARGET_VOICE_CHANNEL_ID}) bulunamadı!`);
  }

  try {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch (error) {
        connection.destroy();
        setTimeout(() => connectToVoice(guild), 3000);
      }
    });

    console.log(`🔊 Bot başarıyla ${channel.name} ses kanalına sabitlendi ve 7/24 aktif!`);
  } catch (error) {
    console.error('Ses kanalına bağlanırken hata oluştu:', error);
  }
}

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} Sistem Aktif!`);

  const commands = [
    new SlashCommandBuilder()
      .setName('ac-panel')
      .setDescription('Sadece AntiCheat başvuru panelini kurar.'),
    new SlashCommandBuilder()
      .setName('yetkili-panel')
      .setDescription('Sadece Normal Yetkili başvuru panelini kurar.')
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    for (const guild of client.guilds.cache.values()) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body: commands },
      );
      connectToVoice(guild);
    }
    console.log('✅ Slash (/) komutları yüklendi ve ses bağlantısı başlatıldı!');
  } catch (error) {
    console.error(error);
  }
});

// ==========================================
// 1. YÖNTEM: SLASH (/) KOMUTLARI
// ==========================================
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ac-panel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Bu komutu kullanmak için yetkin yok.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#2b2d31') // Şık Discord koyu tema rengi
        .setTitle('🛡️ FEST GUN | AC Başvuru Paneli')
        .setDescription(
          '### Sunucu Güvenliğinde Yeni Bir Adım At!\n\n' +
          'Sunucumuzun güvenlik duvarını güçlendirmek, hileleri anında tespit etmek ve profesyonel AntiCheat ekibimizin bir parçası olmak istiyorsan hemen alttaki butona tıklayarak formu doldurabilirsin.\n\n' +
          '> ⚠️ *Lütfen formda dürüst ve açıklayıcı olmaya özen gösterin.*'
        )
        .setFooter({ text: 'FEST GUN • AntiCheat Departmanı © Tüm Hakları Saklıdır.' })
        .setTimestamp();

      if (TARGET_IMAGE) embed.setImage(TARGET_IMAGE);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('apply_ac')
          .setLabel('AntiCheat Başvurusu Yap')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛡️')
      );

      await interaction.reply({ content: '✅ AC Başvuru paneli bu kanala başarıyla kuruldu!', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    } 
    else if (interaction.commandName === 'yetkili-panel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Bu komutu kullanmak için yetkin yok.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('👑 FEST GUN | Normal Yetkili Başvuru Paneli')
        .setDescription(
          '### Ailemize Katıl ve Yönetimde Söz Sahibi Ol!\n\n' +
          'Sunucu içi düzeni sağlamak, aktifliği yönetmek ve topluluğumuzu büyüütmek için yetkili ekibimizde yerini al. Hemen alttaki butona basarak başvuru formunu doldur!\n\n' +
          '> ⚠️ *Ekip kurallarına uyum sağlamak esastır.*'
        )
        .setFooter({ text: 'FEST GUN • Yetkili Yönetimi © Tüm Hakları Saklıdır.' })
        .setTimestamp();

      if (TARGET_IMAGE) embed.setImage(TARGET_IMAGE);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('apply_staff')
          .setLabel('Normal Yetkili Başvurusu Yap')
          .setStyle(ButtonStyle.Success)
          .setEmoji('👑')
      );

      await interaction.reply({ content: '✅ Normal Yetkili paneli bu kanala başarıyla kuruldu!', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }
  }

  // ==========================================
  // BUTON VE MODAL YÖNETİMİ
  // ==========================================
  if (interaction.isButton()) {
    if (interaction.customId === 'apply_ac') {
      const modal = new ModalBuilder()
        .setCustomId('modal_ac')
        .setTitle('🛡️ AntiCheat Başvuru Formu');

      const adYas = new TextInputBuilder()
        .setCustomId('ac_adyas')
        .setLabel('Adınız ve Yaşınız?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örn: Metehan, 19')
        .setRequired(true);

      const deneyim = new TextInputBuilder()
        .setCustomId('ac_deneyim')
        .setLabel('Hile tespiti / AC hakkında detaylı bilgin?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Daha önce hangi yöntemleri kullandın, scanner bilgin nedir?')
        .setRequired(true);

      const ekstra = new TextInputBuilder()
        .setCustomId('ac_ekstra')
        .setLabel('Eklemek istediğiniz özel durum var mı?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Kendi scannerınız var mı, başka ne katabilirsiniz?')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(adYas),
        new ActionRowBuilder().addComponents(deneyim),
        new ActionRowBuilder().addComponents(ekstra)
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
        .setPlaceholder('Örn: Kerem, 17')
        .setRequired(true);

      const gecmis = new TextInputBuilder()
        .setCustomId('staff_gecmis')
        .setLabel('Daha önce hangi sunucularda yetkililik yaptın?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Sunucu isimleri ve aldığın görevleri yaz...')
        .setRequired(true);

      const nedenSen = new TextInputBuilder()
        .setCustomId('staff_neden')
        .setLabel('Neden sizi seçmeliyiz / Kendinizden bahsedin?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Aktiflik süren ve yetkinliklerin...')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(adYas),
        new ActionRowBuilder().addComponents(gecmis),
        new ActionRowBuilder().addComponents(nedenSen)
      );

      await interaction.showModal(modal);
    }
  } 

  // ==========================================
  // FORM GÖNDERİMİ & GELİŞMİŞ YAPAY ZEKA ANALİZİ (+ / -)
  // ==========================================
  else if (interaction.isModalSubmit()) {
    
    const kufurListesi = ['amk', 'aq', 'sik', 'orospu', 'oç', 'piç', 'anan', 'baban', 'mal', 'rak', 'mastürbasyon', '31', 'yarrak'];
    
    if (interaction.customId === 'modal_ac') {
      const adYas = interaction.fields.getTextInputValue('ac_adyas');
      const deneyim = interaction.fields.getTextInputValue('ac_deneyim');
      const ekstra = interaction.fields.getTextInputValue('ac_ekstra') || "Belirtilmemiş";

      const tumMetin = (adYas + " " + deneyim + " " + ekstra).toLowerCase();
      const kufurVarMi = kufurListesi.some(kelime => tumMetin.includes(kelime));

      let puan = 75;
      let durum = "🟢 **Güçlü Aday / Mülakata Uygun**";
      let analizNotlari = [];

      // Küfür / Argo Kontrolü
      if (kufurVarMi) {
        puan = 10;
        durum = "🚨 **ŞÜPHELİ / KÜFÜR TESPİT EDİLDİ!**";
        analizNotlari.push("`-` Form içeriğinde argo/küfür bulundu.");
      } else {
        analizNotlari.push("`+` Temiz ve seviyeli bir dil kullanılmış.");
      }

      // Deneyim Detay Analizi
      if (deneyim.length > 120) {
        puan += 20;
        analizNotlari.push("`+` Teknik hile tespiti ve scanner bilgisi oldukça detaylı.");
      } else if (deneyim.length < 40) {
        puan -= 15;
        analizNotlari.push("`-` Teknik deneyim açıklaması zayıf ve kısa bırakılmış.");
      } else {
        analizNotlari.push("`+` Deneyim açıklaması orta düzeyde yeterli.");
      }

      // Ekstra Durum Analizi
      if (ekstra !== "Belirtilmemiş" && ekstra.length > 10) {
        puan += 10;
        analizNotlari.push("`+` Aday ekstra detaylar ekleyerek kendini öne çıkarmış.");
      } else {
        analizNotlari.push("`-` Ekstra bir özel bilgi paylaşılmamış.");
      }

      if (puan > 100) puan = 100;
      if (puan < 0) puan = 0;

      const logChannel = interaction.guild.channels.cache.get(AC_LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor(kufurVarMi ? '#FF0000' : '#1f85de')
          .setTitle('🛡️ AntiCheat Başvuru Detaylı Analiz Raporu')
          .addFields(
            { name: '👤 Başvuran', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
            { name: '📝 Ad / Yaş', value: adYas, inline: true },
            { name: '⚙️ Teknik Deneyim & Scanner', value: deneyim, inline: false },
            { name: '💡 Ekstra Detaylar', value: ekstra, inline: false },
            { name: '🤖 Yapay Zeka Artı / Eksi Değerlendirmesi', value: `**Skor:** \`${puan}/100\`\n**Statü:** ${durum}\n\n**Kriter Analizleri:**\n${analizNotlari.join('\n')}`, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: 'FEST GUN AC Güvenlik Sistemi' });

        if (TARGET_IMAGE) embed.setImage(TARGET_IMAGE);

        const etiketler = `<@&${ROL_1}> <@&${ROL_2}>`;
        await logChannel.send({ content: `${etiketler} Yeni bir AntiCheat başvurusu var!`, embeds: [embed] });
      }

      await interaction.reply({ content: '✅ AntiCheat başvurunuz başarıyla şifrelenerek yetkili ekibimize iletilmiştir!', ephemeral: true });
    } 
    else if (interaction.customId === 'modal_staff') {
      const adYas = interaction.fields.getTextInputValue('staff_adyas');
      const gecmis = interaction.fields.getTextInputValue('staff_gecmis');
      const nedenSen = interaction.fields.getTextInputValue('staff_neden');

      const tumMetin = (adYas + " " + gecmis + " " + nedenSen).toLowerCase();
      const kufurVarMi = kufurListesi.some(kelime => tumMetin.includes(kelime));

      let puan = 75;
      let durum = "🟢 **Mükemmel Aday / Görüşmeye Davet Edilmeli**";
      let analizNotlari = [];

      if (kufurVarMi) {
        puan = 10;
        durum = "🚨 **ŞÜPHELİ / KÜFÜR TESPİT EDİLDİ!**";
        analizNotlari.push("`-` Başvuru metninde küfür/argo ifadeler tespit edildi.");
      } else {
        analizNotlari.push("`+` Uygun ve temiz bir üslup kullanılmış.");
      }

      if (gecmis.toLowerCase().includes('yok') || gecmis.length < 15) {
        puan -= 20;
        analizNotlari.push("`-` Önceki yetkililik geçmişi zayıf veya hiç belirtilmemiş.");
      } else {
        puan += 15;
        analizNotlari.push("`+` Geçmiş yetkililik tecrübeleri bulunuyor.");
      }

      if (nedenSen.length > 60) {
        puan += 10;
        analizNotlari.push("`+` Motivasyon ve kendini tanıtma yazısı oldukça tatmin edici.");
      } else {
        analizNotlari.push("`-` Kendini tanıtma bölümü kısa tutulmuş.");
      }

      if (puan > 100) puan = 100;
      if (puan < 0) puan = 0;

      const logChannel = interaction.guild.channels.cache.get(YETKILI_LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor(kufurVarMi ? '#FF0000' : '#57f287')
          .setTitle('👑 Normal Yetkili Başvuru Detaylı Analiz Raporu')
          .addFields(
            { name: '👤 Başvuran', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
            { name: '📝 Ad / Yaş', value: adYas, inline: true },
            { name: '📋 Geçmiş Yetkililikler', value: gecmis, inline: false },
            { name: '💬 Motivasyon / Kendini Tanıtma', value: nedenSen, inline: false },
            { name: '🤖 Yapay Zeka Artı / Eksi Değerlendirmesi', value: `**Skor:** \`${puan}/100\`\n**Statü:** ${durum}\n\n**Kriter Analizleri:**\n${analizNotlari.join('\n')}`, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: 'FEST GUN Yönetim Sistemi' });

        if (TARGET_IMAGE) embed.setImage(TARGET_IMAGE);

        const etiketler = `<@&${ROL_1}> <@&${ROL_2}>`;
        await logChannel.send({ content: `${etiketler} Yeni bir Normal Yetkili başvurusu var!`, embeds: [embed] });
      }

      await interaction.reply({ content: '✅ Normal yetkili başvurunuz başarıyla şifrelenerek yönetim ekibimize iletilmiştir!', ephemeral: true });
    }
  }
});

// ==========================================
// 2. YÖNTEM: ÜNLEMLİ MESAJ KOMUTLARI (!ac-panel / !yetkili-panel)
// ==========================================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

  if (message.content === '!ac-panel') {
    await message.delete().catch(() => {});

    const embed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle('🛡️ FEST GUN | AC Başvuru Paneli')
      .setDescription(
        '### Sunucu Güvenliğinde Yeni Bir Adım At!\n\n' +
        'Sunucumuzun güvenlik duvarını güçlendirmek, hileleri anında tespit etmek ve profesyonel AntiCheat ekibimizin bir parçası olmak istiyorsan hemen alttaki butona tıklayarak formu doldurabilirsin.\n\n' +
        '> ⚠️ *Lütfen formda dürüst ve açıklayıcı olmaya özen gösterin.*'
      )
      .setFooter({ text: 'FEST GUN • AntiCheat Departmanı © Tüm Hakları Saklıdır.' })
      .setTimestamp();

    if (TARGET_IMAGE) embed.setImage(TARGET_IMAGE);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('apply_ac')
        .setLabel('AntiCheat Başvurusu Yap')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛡️')
    );

    await message.channel.send({ embeds: [embed], components: [row] });
  } 
  else if (message.content === '!yetkili-panel') {
    await message.delete().catch(() => {});

    const embed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle('👑 FEST GUN | Normal Yetkili Başvuru Paneli')
      .setDescription(
        '### Ailemize Katıl ve Yönetimde Söz Sahibi Ol!\n\n' +
        'Sunucu içi düzeni sağlamak, aktifliği yönetmek ve topluluğumuzu büyütmek için yetkili ekibimizde yerini al. Hemen alttaki butona basarak başvuru formunu doldur!\n\n' +
        '> ⚠️ *Ekip kurallarına uyum sağlamak esastır.*'
      )
      .setFooter({ text: 'FEST GUN • Yetkili Yönetimi © Tüm Hakları Saklıdır.' })
      .setTimestamp();

    if (TARGET_IMAGE) embed.setImage(TARGET_IMAGE);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('apply_staff')
        .setLabel('Normal Yetkili Başvurusu Yap')
        .setStyle(ButtonStyle.Success)
        .setEmoji('👑')
    );

    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

client.login(process.env.TOKEN);
