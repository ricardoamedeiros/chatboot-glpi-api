'use strict';
const BootBot = require('bootbot');
const axios = require('axios');
const AssistantV1 = require('ibm-watson/assistant/v1');
const {
  GlpiClient
} = require("glpi-client");
const glpiUrl = "https://suporte.sebrae.com.br/";
const glpiApiURL = glpiUrl + "apirest.php/";
const tokenUserGLPI = 'zLyq28aZxgKDH9N9QaSltWeG8pCcXCcDnCtqyAcB';
const tokenAppGLPI = 'JLheG4k7ij5GYxS3sFx9oTQbcWmmhJFNqYJRh1IA';
const origem = 7;
const idWorkspace = 'e2226645-5e7a-4f03-a906-0de56221b676';

const service = new AssistantV1({
  version: '2019-02-01',
  iam_apikey: 'gVBda6TBS-P-FOh1PtONA6466tqB9rlxlfT9CLT8Npqp',
  url: 'https://gateway.watsonplatform.net/assistant/api'
});
const tokenFacebook = 'DQVJ0TG9UaHdVYzQzcHdhVTVLR1BRU29YSkI5eXdsVnR0eVlQRWVNd29reFZA3QjBZAUFVWczZAVVVN6VGpFMVhKa043d2h6ZAlJLaEl0cTBnVGgtM3FtRGJPUFNncUdPMERISHJ4UGFFTVktM2FodEZAmbllyM2J1SWVQMUdrRGJxNmpEWlhmWmpXdFg1Vng5cU1GMVdQMTBEUzFGOHFBZAlhWWTlOLXBlQ1UyVmQzTmNRTUx4ZAExJUzdfSTVvZAThGV3RNcDlFeHM3OWRjODBfVDVMZAwZDZD';

const bot = new BootBot({
  accessToken: tokenFacebook,
  verifyToken: 's4bot',
  appSecret: '7620d4bae11c90f954328ac6ea9e1456'
});

const getUserAccount = async (user) => {
  return await axios.get("https://graph.facebook.com/v2.6/" + user + "?fields=email,name&access_token=" + tokenFacebook);
}

const initSession = async () => {
  let headers = {
    'headers': {
      Authorization: 'user_token ' + tokenUserGLPI,
      'App-Token': tokenAppGLPI
    }
  };
  return await axios.get(glpiApiURL + 'initSession', headers)
}

const killSession = async (session) => {
  let headers = {
    'headers': {
      'Session-Token': session,
      'App-Token': tokenAppGLPI
    }
  };
  return await axios.get(glpiApiURL + 'killSession', headers)
}

const getRequester = async (session, idTicket) => {
  let headers = {
    'headers': {
      'Session-Token': session,
      'App-Token': tokenAppGLPI
    }
  };
  return await axios.get(glpiApiURL + 'Ticket/' + idTicket + '/Ticket_User', headers)
}

const getUser = async (session, email) => {
  let headers = {
    'headers': {
      'Session-Token': session,
      'App-Token': tokenAppGLPI
    }
  };
  return await axios.get(glpiApiURL + 'User?searchText[name]=' + email, headers)
}

const removeRequerente = async (session, idTicket) => {
  let requerente = await getRequester(session, idTicket);
  let headers = {
    'headers': {
      'Session-Token': session,
      'App-Token': tokenAppGLPI
    }
  };
  return await axios.delete(glpiApiURL + 'Ticket/' + idTicket + '/Ticket_User/' + requerente.data[0].id, headers)
}

const addRequester = async (session, idTicket, email) => {
  let headers = {
    'headers': {
      'Session-Token': session,
      'App-Token': tokenAppGLPI
    }
  };
  let user = []
  try {
    user = await getUser(session, email);
  } catch (err) {
    console.log(err)
  }
  let newRequester = {
    "input": {
      "tickets_id": idTicket,
      "users_id": 0,
      "type": 1,
      "use_notification": 1,
      "alternative_email": email
    }
  }
  if (user.data.length > 0) {
    newRequester = {
      "input": {
        "tickets_id": idTicket,
        "users_id": user.data[0].id,
        "type": 1,
        "use_notification": 1,
      }
    }
  }
  return await axios.post(glpiApiURL + 'Ticket_User', newRequester, headers);
}

const postCriarTicket = async (session, ticket) => {
  let headers = {
    'headers': {
      'Session-Token': session,
      'App-Token': tokenAppGLPI
    }
  };
  return await axios.post(glpiApiURL + 'Ticket', ticket, headers);
}

const criarTicket = async (descricao, titulo, email, idEntidade) => {
  let resposta = await initSession();
  let session = resposta.data.session_token;
  let newTicket = {
    "input": {
      "entities_id": idEntidade,
      "name": titulo,
      "content": descricao,
      "requesttypes_id": origem
    }
  };
  let ticket = await postCriarTicket(session, newTicket);
  await removeRequerente(session, ticket.data.id);
  await addRequester(session, ticket.data.id, email);
  await killSession(session);
  return ticket.data.id;
}

bot.on('message', async (payload, chat) => {
  const text = payload.message.text;
  let dialogo = await service.message({
    workspace_id: idWorkspace,
    input: {
      'text': text
    }
  });
  if (dialogo.intents.length > 0 && dialogo.context.id_entity > 0) {
    let usuario = await getUserAccount(chat.userId);
    let ticket = await criarTicket(text, 'Requisição via chatbot', usuario.data.email, dialogo.context.id_entity)

    chat.say({
      cards: [{
        'title': `Novo ticket #${ticket}`,
        'image_url': `${glpiUrl}perfil/default.jpg`,
        "subtitle": `Acompanhe por e-mail ou pelo link:`,
        default_action: {
          "type": "web_url",
          'messenger_extensions': false,
          'webview_share_button': 'hide',
          "url": `${glpiUrl}front/ticket.form.php?id=${ticket}`,
          "webview_height_ratio": "full"
        }
      }]
    });
  } else {
    chat.say('Poderia detalhar melhor? Ainda não conseguir entender.');
  }

});

bot.start();