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
const YETKILI_LOG_CHANNEL_ID = "1546240461822361710"; // Yetkili Log Kanalı

const ROL_1 = "1542872121833820322";                 // Etiketlenecek 1. Rol
const ROL_2 = "1542872252045856879";                 // Etiketlenecek 2. Rol

const TARGET_VOICE_CHANNEL_ID = "1542872463870922814"; // 7/24 Duracağı Ses Kanalı ID'si
const TARGET_IMAGE = "https://cdn.discordapp.com/attachments/1542872935809814688/1543803508547915786/ChatGPT_Image_31_Agu_2026_05_01_30.png?ex=6a9ec44e&is=6a9d72ce&hm=1a1a3cd5515ea1d43d8d89a44c16ff71702398ef3da14e341032e7c8144ecc37&"; 

const basvuranlarAC = new Set();
const basvuranlarStaff = new Set();

// Gerçek ve Net Küfür/Hakaret Listesi (Kelime bazlı kontrol edilir, rasgele 31 veya harf kombinasyonlarına takılmaz)
const kufurListesi = [
  'amk', 'aq', 'amina', 'amina koyim', 'amk', 'aq', 'orospu', 'oç', 'piç', 
  'anan', 'baban', 'sik', 'sikerim', 'sikik', 'yarrak', 'amcik', 'göt', 
  'götveren', 'kahpe', 'puşt', 'ibne', 'mal', 'salak', 'gerizekalı', 'aptal', 
  'enayi', 'angut', 'am ko', 'siktimin'
];

function kufurKontrol(metin) {
  const kelimeler = metin.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").split(/\s+/);
  return kelimeler.some(kelime => kufurListesi.includes(kelime));
}

async function connectToVoice(guild) {
  const channel = guild.channels.cache.get(TARGET_VOICE_CHANNEL_ID);
  if (!channel) return;

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
  } catch (error) {
    console.error('Ses bağlantı hatası:', error);
  }
}

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} Sistem Aktif!`);

  const commands = [
    new SlashCommandBuilder().setName('ac-panel').setDescription('AC başvuru paneli'),
    new SlashCommandBuilder().setName('yetkili-panel').setDescription('Yetkili başvuru paneli')
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    for (const guild of client.guilds.cache.values()) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
      connectToVoice(guild);
    }
  } catch (error) {
    console.error(error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ac-panel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;

      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('🛡️ FEST GUN | AC Başvuru Paneli')
        .setDescription('### Sunucu Güvenliğinde Yeni Bir Adım At!\n\nSunucumuzun güvenlik duvarını güçlendirmek için hemen alttaki butona tıklayarak formu doldurabilirsin.');

      if (TARGET_IMAGE) embed.setImage(TARGET_IMAGE);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('apply_ac').setLabel('AntiCheat Başvurusu Yap').setStyle(ButtonStyle.Primary).setEmoji('🛡️')
      );

      await interaction.reply({ content: '✅ AC Paneli kuruldu.', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    } 
    else if (interaction.commandName === 'yetkili-panel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;

      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('👑 FEST GUN | Yetkili Başvuru Paneli')
        .setDescription('### Ailemize Katıl ve Yönetimde Söz Sahibi Ol!\n\nSunucu içi düzeni sağlamak için hemen alttaki basarak başvuru formunu doldur!');

      if (TARGET_IMAGE) embed.setImage(TARGET_IMAGE);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('apply_staff').setLabel('Yetkili Başvurusu Yap').setStyle(ButtonStyle.Success).setEmoji('👑')
      );

      await interaction.reply({ content: '✅ Yetkili paneli kuruldu.', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }
  }

  // BUTON TIKLAMALARI
  if (interaction.isButton()) {
    if (interaction.customId === 'apply_ac') {
      if (basvuranlarAC.has(interaction.user.id)) {
        return interaction.reply({ content: '❌ Zaten AC başvurusu yaptın!', ephemeral: true });
      }

      const modal = new ModalBuilder().setCustomId('modal_ac').setTitle('🛡️ AntiCheat Başvuru Formu');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ac_ad').setLabel('Adınız?').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ac_yas').setLabel('Yaşınız? (En az 12)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ac_deneyim').setLabel('Hile tespiti / AC bilginiz?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ac_ekstra').setLabel('Eklemek istediğiniz özel durum?').setStyle(TextInputStyle.Paragraph).setRequired(false))
      );

      return await interaction.showModal(modal);
    } 
    
    else if (interaction.customId === 'apply_staff') {
      if (basvuranlarStaff.has(interaction.user.id)) {
        return interaction.reply({ content: '❌ Zaten Yetkili başvurusu yaptın!', ephemeral: true });
      }

      const modal = new ModalBuilder().setCustomId('modal_staff').setTitle('👑 Yetkili Başvuru Formu');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('staff_ad').setLabel('Adınız?').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('staff_yas').setLabel('Yaşınız? (En az 12)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('staff_gecmis').setLabel('Önceden hiç yetkili oldunuz mu?').setStyle(TextInputStyle.Paragraph).setPlaceholder('Hangi sunucuda, hangi konumdaydınız?').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('staff_neden').setLabel('Neden sizi seçmeliyiz?').setStyle(TextInputStyle.Paragraph).setRequired(true))
      );

      return await interaction.showModal(modal);
    }
  } 

  // FORM GÖNDERİMLERİ VE ANALİZ
  if (interaction.isModalSubmit()) {
    const hileTehditListesi = ['hile', 'cheat', 'hack', 'ban', 'test etmek', 'denemek için', 'by pass', 'bypass', 'script'];

    if (interaction.customId === 'modal_ac') {
      if (basvuranlarAC.has(interaction.user.id)) return;
      basvuranlarAC.add(interaction.user.id);

      const ad = interaction.fields.getTextInputValue('ac_ad');
      const yasStr = interaction.fields.getTextInputValue('ac_yas');
      const yas = parseInt(yasStr) || 0;
      const deneyim = interaction.fields.getTextInputValue('ac_deneyim');
      const ekstra = interaction.fields.getTextInputValue('ac_ekstra') || "Belirtilmemiş";

      const tumMetin = (ad + " " + yasStr + " " + deneyim + " " + ekstra);
      const kufurVarMi = kufurKontrol(tumMetin);
      const hileTehdidiVarMi = hileTehditListesi.some(k => tumMetin.toLowerCase().includes(k));

      let puan = 75;
      let durum = "🟢 **Güçlü Aday / Mülakata Uygun**";

      if (yas < 12) {
        puan = 0;
        durum = "🚨 **YAŞ KRİTERİNE UYMUYOR (En az 12 olmalı!)**";
      } else if (hileTehdidiVarMi) {
        puan = 0;
        durum = "🚨 **TEHDİT / HİLE İTİRAFI!**";
      } else if (kufurVarMi) {
        puan = 0;
        durum = "🚨 **KÜFÜR / HAKARET TESPİT EDİLDİ!**";
      }

      const logChannel = interaction.guild.channels.cache.get(AC_LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor(puan === 0 ? '#FF0000' : '#1f85de')
          .setTitle('🛡️ AntiCheat Başvuru Raporu')
          .addFields(
            { name: '👤 Başvuran', value: `${interaction.user.tag} (<@${interaction.user.id}>)` },
            { name: '📝 Ad', value: ad, inline: true },
            { name: '🎂 Yaş', value: yasStr, inline: true },
            { name: '⚙️ Deneyim', value: deneyim },
            { name: '💡 Ekstra', value: ekstra },
            { name: '🤖 Değerlendirme', value: `**Skor:** \`${puan}/100\`\n**Statü:** ${durum}` }
          )
          .setTimestamp();

        if (TARGET_IMAGE) embed.setImage(TARGET_IMAGE);
        await logChannel.send({ content: `<@&${ROL_1}> <@&${ROL_2}> Yeni AC başvurusu var!`, embeds: [embed] });
      }

      return await interaction.reply({ content: '✅ AntiCheat başvurunuz iletildi!', ephemeral: true });
    } 
    
    else if (interaction.customId === 'modal_staff') {
      if (basvuranlarStaff.has(interaction.user.id)) return;
      basvuranlarStaff.add(interaction.user.id);

      const ad = interaction.fields.getTextInputValue('staff_ad');
      const yasStr = interaction.fields.getTextInputValue('staff_yas');
      const yas = parseInt(yasStr) || 0;
      const gecmis = interaction.fields.getTextInputValue('staff_gecmis');
      const nedenSen = interaction.fields.getTextInputValue('staff_neden');

      const tumMetin = (ad + " " + yasStr + " " + gecmis + " " + nedenSen);
      const kufurVarMi = kufurKontrol(tumMetin);

      let puan = 75;
      let durum = "🟢 **Mükemmel Aday**";

      if (yas < 12) {
        puan = 0;
        durum = "🚨 **YAŞ KRİTERİNE UYMUYOR (En az 12 olmalı!)**";
      } else if (kufurVarMi) {
        puan = 10;
        durum = "🚨 **KÜFÜR / HAKARET TESPİT EDİLDİ!**";
      }

      const logChannel = interaction.guild.channels.cache.get(YETKILI_LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor(puan === 0 ? '#FF0000' : '#57f287')
          .setTitle('👑 Yetkili Başvuru Raporu')
          .addFields(
            { name: '👤 Başvuran', value: `${interaction.user.tag} (<@${interaction.user.id}>)` },
            { name: '📝 Ad', value: ad, inline: true },
            { name: '🎂 Yaş', value: yasStr, inline: true },
            { name: '📋 Geçmiş Yetkililikler', value: gecmis },
            { name: '💬 Neden Seçmeliyiz?', value: nedenSen },
            { name: '🤖 Değerlendirme', value: `**Skor:** \`${puan}/100\`\n**Statü:** ${durum}` }
          )
          .setTimestamp();

        if (TARGET_IMAGE) embed.setImage(TARGET_IMAGE);
        await logChannel.send({ content: `<@&${ROL_1}> <@&${ROL_2}> Yeni Yetkili başvurusu var!`, embeds: [embed] });
      }

      return await interaction.reply({ content: '✅ Yetkili başvurunuz iletildi!', ephemeral: true });
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

  if (message.content === '!ac-panel') {
    await message.delete().catch(() => {});
    const embed = new EmbedBuilder().setColor('#2b2d31').setTitle('🛡️ FEST GUN | AC Başvuru Paneli').setDescription('Butona basarak başvur.');
    if (TARGET_IMAGE) embed.setImage(TARGET_IMAGE);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('apply_ac').setLabel('AntiCheat Başvurusu Yap').setStyle(ButtonStyle.Primary).setEmoji('🛡️'));
    await message.channel.send({ embeds: [embed], components: [row] });
  } 
  else if (message.content === '!yetkili-panel') {
    await message.delete().catch(() => {});
    const embed = new EmbedBuilder().setColor('#2b2d31').setTitle('👑 FEST GUN | Yetkili Başvuru Paneli').setDescription('Butona basarak başvur.');
    if (TARGET_IMAGE) embed.setImage(TARGET_IMAGE);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('apply_staff').setLabel('Yetkili Başvurusu Yap').setStyle(ButtonStyle.Success).setEmoji('👑'));
    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

client.login(process.env.TOKEN);
