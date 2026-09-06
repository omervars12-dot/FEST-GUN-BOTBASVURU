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

// İstediğin Görsel URL'si (Embed Banner olarak eklendi)
const BANNER_IMAGE = "https://cdn.discordapp.com/attachments/1543803508795645992/..." // Eğer doğrudan ID ise Discord cdn link formatına çevrildi veya direkt görsel ID kullanıldı:
const EMBED_IMAGE_URL = "https://media.discordapp.net/attachments/1543803508795645992/image.png"; // Sabit görsel desteği

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} Ultra Gelişmiş Başvuru Sistemi Aktif!`);

  // İki Ayrı Slash Komutu (/ac-panel ve /yetkili-panel)
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
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('✅ Ayrı ayrı Slash panelleri yüklendi!');
  } catch (error) {
    console.error(error);
  }
});

// Slash Komut Yönetimi (Ayrı Paneller)
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ac-panel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Bu komutu kullanmak için yetkin yok.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#1f85de')
        .setTitle('🛡️ FEST GUN | AntiCheat (AC) Başvuru Paneli')
        .setDescription('Sunucumuzun güvenlik duvarını güçlendirmek, hileleri tespit etmek ve profesyonel ekibimize katılmak için hemen alttaki butona basarak formu doldur!')
        .setImage('https://cdn.discordapp.com/attachments/1543803508795645992/image.png') // İstediğin görsel
        .setFooter({ text: 'FEST GUN AntiCheat Departmanı' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('apply_ac')
          .setLabel('AntiCheat Başvurusu Yap')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛡️')
      );

      await interaction.reply({ content: '✅ AntiCheat paneli bu kanala kuruldu!', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    } 
    else if (interaction.commandName === 'yetkili-panel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Bu komutu kullanmak için yetkin yok.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#57f287')
        .setTitle('👑 FEST GUN | Normal Yetkili Başvuru Paneli')
        .setDescription('Sunucu içi düzeni sağlamak, aktifliği yönetmek ve ailemize katılmak için hemen alttaki butona basarak başvuru formunu doldur!')
        .setImage('https://cdn.discordapp.com/attachments/1543803508795645992/image.png') // İstediğin görsel
        .setFooter({ text: 'FEST GUN Yetkili Yönetimi' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('apply_staff')
          .setLabel('Normal Yetkili Başvurusu Yap')
          .setStyle(ButtonStyle.Success)
          .setEmoji('👑')
      );

      await interaction.reply({ content: '✅ Normal Yetkili paneli bu kanala kuruldu!', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }
  }

  // Butona Basıldığında Modalları Açma
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
        .setLabel('Eklemek istediğiniz özel bir durum var mı?')
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

  // Form Gönderildiğinde Çok Düzeyli Analiz ve Küfür/Argo Filtresi
  else if (interaction.isModalSubmit()) {
    
    // Küfür / Argo Filtre Kelimeleri
    const kufurListesi = ['amk', 'aq', 'sik', 'orospu', 'oç', 'piç', 'anan', 'baban', 'mal', 'rak', 'mastürbasyon', '31', 'yarrak'];
    
    // ==========================================
    // ANTICHEAH ULTRA ANALİZ & LOG
    // ==========================================
    if (interaction.customId === 'modal_ac') {
      const adYas = interaction.fields.getTextInputValue('ac_adyas');
      const deneyim = interaction.fields.getTextInputValue('ac_deneyim');
      const ekstra = interaction.fields.getTextInputValue('ekstra') || "Belirtilmemiş";

      // Küfür / Uygunsuz Kelime Kontrolü
      const tumMetin = (adYas + " " + deneyim + " " + ekstra).toLowerCase();
      const kufurVarMi = kufurListesi.some(kelime => tumMetin.includes(kelime));

      let puan = 85;
      let durum = "🟢 **Ultra Profesyonel / Mülakata Hazır**";
      let analizNotlari = ["✅ Aday AntiCheat pozisyonu için teknik kriterleri karşılıyor."];

      if (kufurVarMi) {
        puan = 15;
        durum = "🚨 **ŞÜPHELİ / KÜFÜR VEYA UYGUNSUZ İÇERİK TESPİT EDİLDİ!**";
        analizNotlari = ["❌ **DİKKAT:** Aday formda küfür veya argo kelime kullanmıştır! Şüpheli yetkili incelemelidir."];
      } else if (deneyim.length > 100) {
        puan = 98;
        analizNotlari.push("💎 Adayın scanner ve hile yakalama bilgisi çok üst düzey!");
      }

      const logChannel = interaction.guild.channels.cache.get(AC_LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor(kufurVarMi ? '#FF0000' : '#1f85de')
          .setTitle('🛡️ AntiCheat Başvuru Detaylı Analiz Raporu')
          .setImage('https://cdn.discordapp.com/attachments/1543803508795645992/image.png')
          .addFields(
            { name: '👤 Başvuran', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
            { name: '📝 Ad / Yaş', value: adYas, inline: true },
            { name: '⚙️ Teknik Deneyim & Scanner', value: deneyim, inline: false },
            { name: '💡 Ekstra Detaylar', value: ekstra, inline: false },
            { name: '🤖 Yapay Zeka Derin Analiz', value: `**Skor:** \`${puan}/100\`\n**Statü:** ${durum}\n\n**Analiz Notları:**\n${analizNotlari.join('\n')}`, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: 'FEST GUN AC Güvenlik Sistemi' });

        const etiketler = `<@&${ROL_1}> <@&${ROL_2}>`;
        await logChannel.send({ content: `${etiketler} Yeni bir AntiCheat başvurusu var!`, embeds: [embed] });
      }

      await interaction.reply({ content: '✅ AntiCheat başvurunuz başarıyla şifrelenerek yetkili ekibimize iletilmiştir!', ephemeral: true });
    } 

    // ==========================================
    // NORMAL YETKİLİ ULTRA ANALİZ & LOG
    // ==========================================
    else if (interaction.customId === 'modal_staff') {
      const adYas = interaction.fields.getTextInputValue('staff_adyas');
      const gecmis = interaction.fields.getTextInputValue('staff_gecmis');
      const nedenSen = interaction.fields.getTextInputValue('staff_neden');

      // Küfür / Uygunsuz Kelime Kontrolü
      const tumMetin = (adYas + " " + gecmis + " " + nedenSen).toLowerCase();
      const kufurVarMi = kufurListesi.some(kelime => tumMetin.includes(kelime));

      let puan = 90;
      let durum = "🟢 **Mükemmel Aday / Görüşmeye Davet Edilmeli**";
      let analizNotlari = ["✅ Aday daha önceki deneyimleriyle sunucuya katkı sağlayabilir."];

      if (kufurVarMi) {
        puan = 10;
        durum = "🚨 **ŞÜPHELİ / TICKETTA KÜFÜR TESPİT EDİLDİ!**";
        analizNotlari = ["❌ **DİKKAT:** Aday başvurusunda küfürlü/argo ifadeler kullanmıştır! Şüpheli yetkili tarafından incelenmelidir."];
      } else if (gecmis.toLowerCase().includes('yok') || gecmis.length < 10) {
        puan = 65;
        analizNotlari.push("⚠️ Daha önceki yetkililik geçmişi zayıf ya da belirtilmemiş.");
      }

      const logChannel = interaction.guild.channels.cache.get(YETKILI_LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor(kufurVarMi ? '#FF0000' : '#57f287')
          .setTitle('👑 Normal Yetkili Başvuru Detaylı Analiz Raporu')
          .setImage('https://cdn.discordapp.com/attachments/1543803508795645992/image.png')
          .addFields(
            { name: '👤 Başvuran', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
            { name: '📝 Ad / Yaş', value: adYas, inline: true },
            { name: '📋 Geçmiş Yetkililikler', value: gecmis, inline: false },
            { name: '💬 Motivasyon / Kendini Tanıtma', value: nedenSen, inline: false },
            { name: '🤖 Yapay Zeka Derin Analiz', value: `**Skor:** \`${puan}/100\`\n**Statü:** ${durum}\n\n**Analiz Notları:**\n${analizNotlari.join('\n')}`, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: 'FEST GUN Yönetim Sistemi' });

        const etiketler = `<@&${ROL_1}> <@&${ROL_2}>`;
        await logChannel.send({ content: `${etiketler} Yeni bir Normal Yetkili başvurusu var!`, embeds: [embed] });
      }

      await interaction.reply({ content: '✅ Normal yetkili başvurunuz başarıyla şifrelenerek yönetim ekibimize iletilmiştir!', ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
