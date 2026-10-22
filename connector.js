// Registrerer hvilke "capabilities" power-upen har.
// Alt kjører i nettleseren til brukeren; ingen data sendes til vår server.
const ICON = new URL('./icon.svg', window.location.href).href;

window.TrelloPowerUp.initialize({
  'board-buttons': function () {
    return [{
      icon: { dark: ICON, light: ICON },
      text: 'Swimlanes',
      callback: function (t) {
        return t.modal({
          url: './swimlanes.html',
          fullscreen: true,
          title: 'Swimlanes'
        });
      }
    }];
  }
});
