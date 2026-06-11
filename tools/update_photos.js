import fs from 'fs';

const photos = {
  "arg_lionelmessi": "https://upload.wikimedia.org/wikipedia/commons/b/b4/Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg",
  "arg_emilianomartinez": "https://upload.wikimedia.org/wikipedia/commons/1/15/1_Emiliano_Mart%C3%ADnez_2018_%28cropped%29.jpg",
  "ptg_cristianoronaldo": "https://upload.wikimedia.org/wikipedia/commons/d/d7/Cristiano_Ronaldo_playing_for_Al_Nassr_FC.jpg",
  "egy_mohamedsalah": "https://upload.wikimedia.org/wikipedia/commons/c/c1/Mohamed_Salah_2018_%28cropped%29.jpg",
  "kor_songbumkeun": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Song_Bum-keun_2024.jpg/800px-Song_Bum-keun_2024.jpg",
  "can_jaydennelson": "https://upload.wikimedia.org/wikipedia/commons/a/a1/Jayden_Nelson.jpg",
  "bra_edersonsilva": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Ederson_dos_Santos_Louren%C3%A7o_da_Silva_2024.jpg/800px-Ederson_dos_Santos_Louren%C3%A7o_da_Silva_2024.jpg",
  "cuw_eloyroom": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Room_Eloy_Columbus_Crew_SC_Meet_the_Team_2019.jpg",
  "cuw_tahithchong": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Tahith_Chong_%2838487929362%29.jpg/800px-Tahith_Chong_%2838487929362%29.jpg",
  "cuw_leandrobacuna": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Leandro_Bacuna.jpg",
  "cuw_juninhobacuna": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Juninho_bacuna-1531777726.jpeg",
  "cuw_riechedlybazoer": "https://upload.wikimedia.org/wikipedia/commons/a/a1/Go_Ahead_Eagles_-_AZ_-_53170906955_%28Riechedly_Bazoer%29.jpg",
  "cuw_joshuabrenet": "https://upload.wikimedia.org/wikipedia/commons/e/ea/2019-05-11_Joshua_Brenet.jpg",
  "cuw_armandoobispo": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Austria_U-18_vs._Netherlands_U-18_2017-03-23_%28060%29.jpg/800px-Austria_U-18_vs._Netherlands_U-18_2017-03-23_%28060%29.jpg",
  "cuw_sherelfloranus": "https://upload.wikimedia.org/wikipedia/commons/a/a1/Sherel_Floranus_at_Antalyaspor_vs_Fatih_Karag%C3%BCmr%C3%BCk_SK_20220213.jpg",
  "cuw_brandleykuwas": "https://upload.wikimedia.org/wikipedia/commons/a/a8/Brandley_Kuwas.png",
  "cuw_juergenlocadia": "https://upload.wikimedia.org/wikipedia/commons/a/a5/J%C3%BCrgen_Locadia.jpg",
  "arg_juanmusso": "https://upload.wikimedia.org/wikipedia/commons/b/b1/Musso_Udinese.png",
  "arg_geronimorulli": "https://upload.wikimedia.org/wikipedia/commons/0/05/Argentina_x_Honduras_-_Futebol_masculino_-_Olimp%C3%ADada_Rio_2016_%2828279700883%29.jpg",
  "ptg_diogocosta": "https://upload.wikimedia.org/wikipedia/commons/b/b1/Diogo_Costa.jpg",
  "ptg_josesa": "https://upload.wikimedia.org/wikipedia/commons/b/b4/Jos%C3%A9_S%C3%A1_USMNT_v_Portugal_Mar_31_2026-185_%28cropped%29.jpg",
  "egy_mohamedelshenawy": "https://upload.wikimedia.org/wikipedia/commons/d/d1/Mohamed_El_Shenawy.jpg",
  "egy_mostafashoubir": "https://upload.wikimedia.org/wikipedia/commons/b/b9/Mostafa_Shobeir.jpg",
  "egy_mohamedabdelmoneim": "https://upload.wikimedia.org/wikipedia/commons/a/a6/Mohamed_Abdelmonem.jpg",
  "egy_omarmarmoush": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Omar_Marmoush_in_2023.jpg/800px-Omar_Marmoush_in_2023.jpg",
  "egy_zizo": "https://upload.wikimedia.org/wikipedia/commons/a/a3/A.Zizo.jpg",
  "irn_alirezabeiranvand": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Alireza_Beiranvand_20191201.jpg/800px-Alireza_Beiranvand_20191201.jpg",
  "irn_ehsanhajisafi": "https://upload.wikimedia.org/wikipedia/commons/c/c9/Ehsan_Hajsafi_at_IRNPOR_match_2018_FIFA_World_Cup.jpg",
  "irn_alirezajahanbakhsh": "https://upload.wikimedia.org/wikipedia/commons/a/a0/Alireza_Jahanbakhsh_2018.jpg",
  "irn_samanghoddos": "https://upload.wikimedia.org/wikipedia/commons/b/b1/Saman_Ghoddos_-_2018_FIFA_World_Cup.jpg",
  "irn_mehditaremi": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Mehdi_Taremi_WC2022.jpg/800px-Mehdi_Taremi_WC2022.jpg",
  "ptg_rubendias": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/R%C3%BAben_Dias_2024.jpg/800px-R%C3%BAben_Dias_2024.jpg",
  "ptg_brunofernandes": "https://upload.wikimedia.org/wikipedia/commons/b/b4/Bruno_Fernandes_2018_%28cropped%29.jpg",
  "ptg_bernardosilva": "https://upload.wikimedia.org/wikipedia/commons/b/b4/Bernardo_Silva_2017.jpg",
  "ptg_rafaelleao": "https://upload.wikimedia.org/wikipedia/commons/b/b1/RafaelLe%C3%A3oPortugal23.jpg",
  "ptg_joaofelix": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Jo%C3%A3o_Felix.jpg",
  "cro_lukamodric": "https://upload.wikimedia.org/wikipedia/commons/b/bf/Luka_Modric_2018.png",
  "cro_joskogvardiol": "https://upload.wikimedia.org/wikipedia/commons/d/d1/Josko_Gvardiol.jpg",
  "col_luisdiaz": "https://upload.wikimedia.org/wikipedia/commons/a/a8/Luis_D%C3%ADaz_%28portrait%29.jpg",
  "col_jamesrodriguez": "https://upload.wikimedia.org/wikipedia/commons/c/c5/James_Rodr%C3%ADguez_%28cropped%29.jpg",
  "cro_dominiklivakovic": "https://upload.wikimedia.org/wikipedia/commons/b/b1/Dominik_Livakovi%C3%87_2021.jpg"
};

let data = fs.readFileSync('../data.js', 'utf8');

for (const [id, url] of Object.entries(photos)) {
  const searchStr = `"id": "${id}"`;
  const startIndex = data.indexOf(searchStr);
  if (startIndex === -1) {
    console.log(`Could not find ID: ${id}`);
    continue;
  }
  
  const photoIndex = data.indexOf('"photo": ""', startIndex);
  if (photoIndex !== -1 && photoIndex - startIndex < 500) {
    const before = data.slice(0, photoIndex);
    const after = data.slice(photoIndex + 11);
    data = before + `"photo": "${url}"` + after;
    console.log(`Updated photo for ${id}`);
  } else {
    // Check if it was already updated
    const photoField = data.slice(photoIndex, photoIndex + 50);
    if (!photoField.includes('"photo": ""')) {
       // console.log(`Photo for ${id} already has a URL or is not empty.`);
    } else {
       console.log(`Could not find empty photo field for ID: ${id}`);
    }
  }
}

fs.writeFileSync('../data.js', data);
console.log('Updated data.js with new photos.');
