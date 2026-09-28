/* ==========================================================
   Kizuna · Sesión en páginas públicas
   Si hay un deportista con sesión y perfil completo, abre los
   calendarios de reserva (TNBooking.unlock) y completa sus datos
   en la suscripción (window.TNAthlete). Si no, deja el aviso para entrar o registrarse.

   <script type="module" src="js/sesion.js"></script>
   Va después de js/booking.js.
   ========================================================== */
import { onAthlete, isComplete, fullName } from "./deportista.js";

const B = window.TNBooking;
// window.TNAthlete: undefined = revisando · null = sin cuenta o perfil a medias · { uid, name, email }
const link = document.querySelector("[data-account-link]");
let unlocked = false;

onAthlete(({ user, profile, error }) => {
  if (link) link.textContent = !user ? "Entrar" : profile?.nombre ? `Hola, ${profile.nombre}` : "Mi cuenta";

  // Cerró sesión (en otra pestaña) con el calendario ya abierto
  if (unlocked && !user) { location.reload(); return; }

  window.TNAthlete = user && isComplete(profile) ? { uid: user.uid, name: fullName(profile), email: user.email } : null;

  if (user && isComplete(profile)) {
    const name = fullName(profile);
    // Formulario de suscripción de la portada
    const pName = document.getElementById("pName"), pEmail = document.getElementById("pEmail");
    if (pName && !pName.value) pName.value = name;
    if (pEmail && !pEmail.value) pEmail.value = user.email;
  }

  if (!B || !B.requireAccount || unlocked) return;
  if (!user) return B.lock("anon");
  if (error) { console.warn(error); return B.lock("error"); }
  if (!isComplete(profile)) return B.lock("incomplete");
  unlocked = true;
  B.unlock({ uid: user.uid, name: fullName(profile), email: user.email, phone: profile.telefono });
});
