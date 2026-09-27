/* ==========================================================
   Kizuna · Técnicas por cinturón (judo.html)
   Al hacer clic en un cinturón de #grados se abre una ventana
   con el programa del grado y el video de cada técnica.

   Videos: canal oficial del Kodokan (youtube.com/@KODOKANJUDO),
   lista "KODOKAN × IJF ACADEMY 100 Techniques".
   Programa: Reglamento de ascenso grados kyu 2024–2028,
   Federación Deportiva Nacional de Judo de Chile.

   Cada técnica es [nombre, idDeYouTube]. Sin id = se enseña en
   clase (no hay video del Kodokan).
   ========================================================== */
(function(){
  const NAGE_NO_KATA = ["Nage-no-kata", "bkhBZzE2HpM"];

  const BELTS = {
    blanco: {
      name: "Blanco", grade: "6° kyu", cls: "w",
      intro: "Lo que aprendes con cinturón blanco para rendir el examen a amarillo.",
      groups: [
        { title: "Nage-waza · Proyecciones", items: [
          ["O-soto-otoshi", "2DsVvDw7b8g"], ["O-soto-gari", "c-A_nP7mKAc"],
          ["Uki-goshi", "bPKwtB4lyOQ"], ["O-goshi", "yhu1mfy2vJ4"],
          ["Ippon-seoi-nage", "FQnOlCxo4oI"], ["De-ashi-barai", "4BUUvqxi_Kk"],
          ["Tai-otoshi", "4x6S3Q-Ktv8"], ["O-uchi-gari", "0itJFhV9pDQ"],
          ["Ko-uchi-gari", "3Jb3tZvr9Ng"], ["Ko-soto-gari", "jeQ541ScLB4"],
          ["Ko-soto-gake", "8b6kY4s4zH4"]
        ]},
        { title: "Katame-waza · Inmovilizaciones y salidas", items: [
          ["Kesa-gatame", "NDaQuJOFBYk"], ["Salida de Kesa-gatame", "5_TS0YHdxcQ"],
          ["Kuzure-kesa-gatame", "Q2fb9jaoUFQ"], ["Salida de Kuzure-kesa-gatame", "-zFQ6h4yKT4"],
          ["Yoko-shiho-gatame", "TT7XJVSEQxA"], ["Salida de Yoko-shiho-gatame", "yK_GSamSPko"]
        ]},
        { title: "Ukemi y fundamentos", items: [
          ["Mae-ukemi"], ["Yoko-ukemi"], ["Ushiro-ukemi"], ["Zempo-kaiten-ukemi"],
          ["Shizentai y Jigotai"], ["Tai-sabaki y Tsugi-ashi"], ["Kumikata"],
          ["Kuzushi · Tsukuri · Kake"]
        ]}
      ]
    },
    amarillo: {
      name: "Amarillo", grade: "5° kyu", cls: "y",
      intro: "Lo que aprendes con cinturón amarillo para rendir el examen a naranja.",
      groups: [
        { title: "Nage-waza · Proyecciones", items: [
          ["Morote-seoi-nage", "zIq0xI0ogxk"], ["Tsuri-goshi", "51Htlp7xEvE"],
          ["Uki-goshi", "bPKwtB4lyOQ"], ["O-goshi", "yhu1mfy2vJ4"],
          ["Koshi-guruma", "SU7Id6uVJ44"], ["Tsurikomi-goshi", "McfzA0yRVt4"],
          ["Sode-tsurikomi-goshi", "QsmAxpmYLOI"], ["Sasae-tsurikomi-ashi", "699i--pvYmE"],
          ["Tsubame-gaeshi", "GwweWqqFB5g"], ["Okuri-ashi-barai", "nw1ZdRjrdRI"],
          ["Ko-uchi-gari", "3Jb3tZvr9Ng"], ["Ko-soto-gari", "jeQ541ScLB4"]
        ]},
        { title: "Katame-waza · Suelo", items: [
          ["Kami-shiho-gatame", "HFuMjOv0WN8"], ["Salida de Kami-shiho-gatame", "seGsXy9I4G8"],
          ["Kuzure-kami-shiho-gatame", "YUrogQWdwiY"], ["Salida de Kuzure-kami-shiho-gatame", "PPe7E_7d7UI"],
          ["Tate-shiho-gatame", "55-rFmBx53g"], ["Salida de Tate-shiho-gatame", "JMJBjnst_DA"],
          ["Nami-juji-jime", "k2cHry9HByQ"], ["Gyaku-juji-jime", "t3tQriIPdlI"],
          ["Kata-juji-jime", "3VZVUAmiMD8"], ["Ude-hishigi-juji-gatame", "OWgSOlCuMXw"]
        ]},
        { title: "Otras técnicas", items: [
          ["Ne-waza: ataque entre las piernas"], ["Volteretas con uke"]
        ]}
      ]
    },
    naranja: {
      name: "Naranja", grade: "4° kyu", cls: "o",
      intro: "Lo que aprendes con cinturón naranja para rendir el examen a verde.",
      groups: [
        { title: "Nage-waza · Proyecciones", items: [
          ["Harai-goshi", "qTo8HlAAkOo"], ["Kata-guruma", "cnHRhSy8yi4"],
          ["Uki-otoshi", "6H5tmncOY4Q"], ["Tani-otoshi", "3b9Me3Fohpk"],
          ["Tsurikomi-goshi", "McfzA0yRVt4"], ["Sode-tsurikomi-goshi", "QsmAxpmYLOI"],
          ["Hiza-guruma", "JPJx9-oAVns"], ["Sukui-nage", "vU6aJ2kFxoI"],
          ["Tomoe-nage", "880WbHvHv6A"], ["Uki-waza", "weVOpJ63gII"],
          ["O-soto-guruma", "92KbCm6pQeI"]
        ]},
        { title: "Katame-waza · Suelo", items: [
          ["Kata-gatame", "zQR3IOXxO_Q"], ["Ushiro-kesa-gatame", "SBapox2M2dE"],
          ["Hadaka-jime", "9f0n8jez7iA"], ["Kata-ha-jime", "yaTGgRjnwB8"],
          ["Okuri-eri-jime", "EiqyoVcIAi8"], ["Sode-guruma-jime", "E3nvQzClcAU"],
          ["Ude-garami", "AIlTvZb4RlE"], ["Ude-hishigi-ude-gatame", "SBf0aTma1VI"],
          ["Ude-hishigi-waki-gatame", "8F5p1zuJRG0"]
        ]},
        { title: "Kata y combinaciones", items: [
          NAGE_NO_KATA,
          ["Harai-goshi contra O-soto-gari"], ["Tani-otoshi como contraataque"],
          ["O-uchi-gari → Seoi-nage"], ["Seoi-nage → Kesa-gatame"]
        ]}
      ]
    },
    verde: {
      name: "Verde", grade: "3° kyu", cls: "g",
      intro: "Lo que aprendes con cinturón verde para rendir el examen a azul.",
      groups: [
        { title: "Nage-waza · Proyecciones", items: [
          ["Uchi-mata", "iUpSu5J-bgw"], ["Hane-goshi", "M9_7De6A1kk"],
          ["Ushiro-goshi", "ORIYstuxYT8"], ["Ashi-guruma", "ROeayhvom9U"],
          ["Harai-tsurikomi-ashi", "gGPXvWL8VbE"], ["Morote-gari", "BHLQS4K85bs"],
          ["Hikikomi-gaeshi", "92zUYWBp5N8"], ["Sumi-gaeshi", "5VhduA5xkbA"],
          ["Kuchiki-taoshi", "ZNL47q1aJNY"], ["Kibisu-gaeshi", "tJylJYfBliA"]
        ]},
        { title: "Katame-waza · Suelo", items: [
          ["Ryote-jime", "-RHC4V7TQiY"], ["Tsukkomi-jime", "dKKpnD3eLcY"],
          ["Ude-hishigi-hiza-gatame", "H2HtAJdiJcE"], ["Sankaku-jime", "lq1CUBRAm7s"]
        ]},
        { title: "Kata", items: [ NAGE_NO_KATA ] }
      ]
    },
    azul: {
      name: "Azul", grade: "2° kyu", cls: "b",
      intro: "Lo que aprendes con cinturón azul para rendir el examen a café.",
      groups: [
        { title: "Nage-waza · Proyecciones", items: [
          ["Sumi-otoshi", "lLU9wv52ni0"], ["O-guruma", "SnZciTAY9vc"],
          ["Yoko-wakare", "bp1tscHlePI"], ["Yoko-gake", "tP1Sj1uDfSo"],
          ["Yoko-otoshi", "MnNG67pF_a0"], ["Yoko-guruma", "MehP6I5cY2c"],
          ["Uchi-mata-sukashi", "V-RS3uhtVWM"], ["Harai-makikomi", "VBaHzKaCXss"],
          ["O-soto-makikomi", "DGDv2oMwmas"], ["Uchi-makikomi", "5BowcjduxVc"],
          ["Soto-makikomi", "bWG9O1BVKtQ"]
        ]},
        { title: "Katame-waza · Suelo", items: [
          ["Ude-hishigi-hara-gatame", "ZzEycg8R_9M"], ["Koshi-jime"]
        ]},
        { title: "Kata", items: [ NAGE_NO_KATA ] }
      ]
    },
    cafe: {
      name: "Café", grade: "1° kyu", cls: "br",
      intro: "Lo que aprendes con cinturón café para rendir el examen a negro.",
      groups: [
        { title: "Nage-waza · Proyecciones", items: [
          ["Utsuri-goshi", "4pQd_bEnlf0"], ["Ura-nage", "Fgi9b8DJ5sQ"],
          ["Tawara-gaeshi", "TmTWgrmViZc"], ["Obi-otoshi", "ff8U2TVZIYI"],
          ["Yama-arashi", "MGlyKmSuzdc"], ["Daki-wakare", "Hr0cOMGBDYo"],
          ["Hane-makikomi", "6CRBGLGz9j8"], ["Uchi-mata-makikomi", "jZXENTLpJCI"],
          ["Daki-age"]
        ]},
        { title: "Kaeshi-waza · Contraataques", items: [
          ["Uchi-mata-gaeshi", "Sy6sLWxkWYw"], ["Hane-goshi-gaeshi", "9bZAZSBtnGs"],
          ["Harai-goshi-gaeshi", "4U3It-7PPsc"], ["Ko-uchi-gaeshi", "_MWAdYi_LC4"]
        ]},
        { title: "Proyecciones prohibidas (solo conocerlas)", items: [
          ["Kani-basami", "OR-HGHnarYc"], ["Kawazu-gake", "w6G57bWACi0"]
        ]},
        { title: "Kata", items: [ NAGE_NO_KATA ] }
      ]
    },
    negro: {
      name: "Negro", grade: "1er dan", cls: "k",
      intro: "El examen a 1er dan sigue el reglamento de dan de la Federación. Estas son las dos kata del Kodokan que se preparan para el grado.",
      groups: [
        { title: "Kata", items: [
          NAGE_NO_KATA, ["Katame-no-kata", "SvckHbFDnzk"]
        ]}
      ]
    }
  };

  const modal = document.getElementById("techModal");
  if (!modal) return;
  const $ = sel => modal.querySelector(sel);
  const player = $("[data-tech-player]");
  const nowTitle = $("[data-tech-now]");
  const ytLink = $("[data-tech-yt]");
  let lastFocus = null;

  const esc = s => s.replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

  function play(name, id){
    player.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1" title="${esc(name)} · Kodokan" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    nowTitle.textContent = name;
    ytLink.href = `https://www.youtube.com/watch?v=${id}`;
    modal.querySelectorAll(".tech-item[aria-pressed]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.id === id && b.dataset.name === name)));
  }

  function render(key){
    const b = BELTS[key];
    $("[data-tech-belt]").className = `belt ${b.cls}`;
    $("[data-tech-belt]").textContent = b.name;
    $("#techTitle").innerHTML = `${esc(b.name)} <small>${esc(b.grade)}</small>`;
    $("[data-tech-intro]").textContent = b.intro;

    $("[data-tech-groups]").innerHTML = b.groups.map(g => {
      const withVideo = g.items.filter(i => i[1]);
      const inClass = g.items.filter(i => !i[1]);
      return `<section class="tech-group"><h4>${esc(g.title)}</h4>` +
        (withVideo.length ? `<div class="tech-list">` + withVideo.map(([n, id]) =>
          `<button type="button" class="tech-item" data-name="${esc(n)}" data-id="${id}" aria-pressed="false">
             <img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" loading="lazy" width="320" height="180">
             <span>${esc(n)}</span></button>`).join("") + `</div>` : "") +
        (inClass.length ? `<p class="tech-class"><b>En clase:</b> ${inClass.map(i => esc(i[0])).join(" · ")}</p>` : "") +
        `</section>`;
    }).join("");

    const first = b.groups.flatMap(g => g.items).find(i => i[1]);
    play(first[0], first[1]);
  }

  function open(key){
    lastFocus = document.activeElement;
    render(key);
    modal.hidden = false;
    document.body.classList.add("modal-open");
    modal.scrollTop = 0;
    $(".modal-close").focus();
  }

  function close(){
    modal.hidden = true;
    player.innerHTML = ""; // detiene el video
    document.body.classList.remove("modal-open");
    if (lastFocus) lastFocus.focus();
  }

  modal.addEventListener("click", e => {
    const item = e.target.closest(".tech-item");
    if (item){
      play(item.dataset.name, item.dataset.id);
      player.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    if (e.target === modal || e.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) close(); });

  // Tarjetas de cinturón: toda la fila es clicable; el botón da acceso con teclado.
  document.querySelectorAll(".grade[data-belt]").forEach(card => {
    const key = card.dataset.belt;
    if (!BELTS[key]) return;
    card.classList.add("is-link");
    card.addEventListener("click", () => open(key));
  });
})();
