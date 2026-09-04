/**
 * I font dei temi, self-hosted (docs/adr/0042 e successore). Un tema che
 * vuole un font proprio dichiara un `fonts.css` nella propria cartella e si
 * porta il pacchetto del font come dipendenza — stesso schema che le icone
 * usano già con `lucide-static`: un pacchetto versionato, non una CDN.
 *
 * Nessun `<link>` verso Google Fonts, mai: manderebbe l'IP di ogni
 * visitatore a Google (c'è una condanna tedesca del 2022 su esattamente
 * questo), il che è insostenibile per un prodotto che vende "i dati restano
 * a casa tua" e che genera pure la privacy policy del cliente — e un
 * deployment intranet non funzionerebbe affatto.
 *
 * Import eager e non filtrato per tema, di proposito: i `fonts.css` di
 * tutti i temi bundlati finiscono nel foglio di stile, ma un `@font-face`
 * che nessuna regola referenzia **non scarica nulla** — è inerte per
 * costruzione, non per fortuna. Vale la pena rispetto all'alternativa
 * (iniettare CSS per richiesta), perché così è Vite a riscrivere gli
 * `url()` e a impacchettare i file del font, che è esattamente ciò che un
 * `@font-face` scritto a mano in `theme.css` non otterrebbe.
 */
import.meta.glob('../../../../themes/*/fonts.css', { eager: true });
