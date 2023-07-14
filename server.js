import express from "express";
import bodyParser from "body-parser";
import { Configuration, OpenAIApi } from "openai";
import path from "path";
import axios from "axios";
import Replicate from "replicate";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
import { get } from "http";
const app = express();
app.use(bodyParser.json());
dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const messages = [
  {
    role: "system",
    content: `You are customer service agent of a company named Noise who make smart watches and you are here to provide support on a product called Noisefit Halo Plus. Here are some basic FAQ related to the product Does NoiseFit Halo Plus have a full touch screen display?
  Yes, NoiseFit Halo Plus features a full touch 1.46” AMOLED display.
  Is NoiseFit Halo Plus shockproof?
  No, NoiseFit Halo Plus is not shockproof. Please avoid dropping it from a height as the watch may get damaged.
  Is NoiseFit Halo Plus waterproof?
  Yes. NoiseFit Halo Plus has an IP68 rating. It can go underwater up to a depth of 1.0m for up to 30 minutes. However, avoid saunas, hot water and ocean water.
  Can NoiseFit Halo Plus be used while swimming?
  You cannot wear it while swimming.
  Can I take a photo with NoiseFit Halo Plus ?
  No. NoiseFit Halo Plus does not feature a remote camera. 
  What is the pixel resolution of my NoiseFit Halo Plus ?
  The display resolution of NoiseFit Halo Plus is 466*466px.
  What notifications can I get on my NoiseFit Halo Plus ?
  You get notifications for SMS, calls, calendar, email, calender, WhatsApp, LinkedIn, Instagram, FB messenger, Skype, Twitter, Facebook, YouTube, Gmail, Outlook, Snapchat and Telegram, as long as the notification feature is turned on and your phone and smartwatch are in Bluetooth range and in sync.
  Does NoiseFit Halo Plus come with a calling feature?
  Yes, NoiseFit Halo Plus comes with Bluetooth calling.
  Does NoiseFit Halo Plus have voice assistance?
  No, NoiseFit Halo Plus does not come with voice assistance.
  Does NoiseFit Halo Plus come with in-built games?
  No, the NoiseFit Halo Plus does not come with in-built games.
  Does it have a phone tracking option?
  Yes, the NoiseFit Halo Plus comes with a phone tracking option. 
  Does NoiseFit Halo Plus have Gesture control?
  No, NoiseFit Halo Plus does not come with Gesture controls. 
  Can I reduce the vibration level in my NoiseFit Halo Plus ?
  Yes, you can control the vibration in NoiseFit Halo Plus .
  Can NoiseFit Halo Plus store and play music?
  NoiseFit Halo Plus has a remote music control feature that controls music played on your phone as long as your smartphone and smartwatch are in Bluetooth range. However, it cannot be used to store music.
  Can I use my earbuds and my NoiseFit Halo Plus at a time with the same smartphone?
  Yes, both earbuds and NoiseFit Halo Plus can be paired with your smartphone at the same time.
  What is the Bluetooth range of NoiseFit Halo Plus ?
  The Bluetooth range of NoiseFit Halo Plus is 10 meters. 
  Can it play music to a Bluetooth headset?
  NoiseFit Halo Plus can control the music played through your smartphone as long as it is connected and synced with the app. The NoiseFit Halo Plus can also control music played via Bluetooth headset as long as the smartphone is paired to the Bluetooth headset and the smartwatch.
  How many watch faces does NoiseFit Halo Plus have?
  NoiseFit Halo Plus comes with 100+ watch faces which you can access and customise via the NoiseFit app.
  Can we change the watch face?
  Yes, you can change the watch faces. From the watch, touch and hold the home screen. Swipe and choose from the watch faces. From the app, go to the watch face, select the watch face of your choice and tap Save to change the watch face. You can even customise your watch face from the app.
  How do I increase the brightness of my NoiseFit Halo Plus ?
  You can set the brightness from the watch. Turn on the watch screen, swipe up from the home screen, select Brightness and adjust it as per your convenience.
  What sensors does the NoiseFit Halo Plus have?
  NoiseFit Halo Plus features HR sensor, Accelerometer and SpO2 sensor.
  Does NoiseFit Halo Plus have GPS?
  No, NoiseFit Halo Plus does not have GPS.
  What are the accessories included with NoiseFit Halo Plus?
  NoiseFit Halo Plus comes with one user manual and magnetic charging cable.

  Provide support and never leave the customer hanging and for complex queries, you can always transfer the chat to a human agent.
  To transfer the chat to a human agent, reply with JSON object containing the following key value pairs:
    {   
        "transfer": true
    }
  `,
  },
  {
    role: "assistant",
    content: "How can I help you?",
  },
];

const getResponse = async (prompt) => {
  messages.push({ role: "user", content: prompt });
  await openai
    .createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: messages,
    })
    .then((response) => {
      messages.push({
        role: "assistant",
        content: response.data.choices[0].message.content,
      });
    })
    .catch((error) => {
      console.log(error);
    })
    .finally(() => {
      return messages;
    });
};

//Whatsapp Part

const access_token = process.env.ACCESS_TOKEN;
const myToken = process.env.MY_TOKEN;

app.get("/webhook", (req, res) => {
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === myToken) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
      console.log("Invalid webhook subscription");
    }
  } else {
    console.log("Missing webhook parameters");
  }
});

const sendMessage = (phone_number_id, from, reply) => {
  axios({
    method: "POST",
    url:
      "https://graph.facebook.com/v15.0/" +
      phone_number_id +
      "/messages?access_token=" +
      access_token,
    data: {
      messaging_product: "whatsapp",
      to: from,
      text: { body: reply },
    },
    headers: { "Content-Type": "application/json" },
  });
};

app.post("/webhook", async (req, res) => {
  try {
    let reply = "Hey";
    if (req.body.entry[0].changes[0].value.messages) {
      let { value } = req.body.entry[0].changes[0];
      let { phone_number_id } = value.metadata;
      let { from } = value.messages[0];
      let message = value.messages[0];
      if (message.text && message.text.body) {
        let prompt = message.text.body.trim();
        if (prompt.startsWith("/imagine")) {
          prompt = prompt.replace("/imagine", "");
          reply = await repliPrompt(prompt);
        } else {
          const response = await getResponse(prompt);
          reply = response[response.length - 1].content;
        }
      } else if (message.image.id) {
        // Handle incoming media message
        console.log("Upscaling request received from: " + from);
        const { id } = message.image;
        const response = await axios({
          method: "GET",
          url: `https://graph.facebook.com/v15.0/${id}`,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access_token}`,
          },
        });
        response.data && console.log("Image metadata received");
        const { url, mime_type: mimeType } = response.data;
        const r = await axios({
          method: "GET",
          url: url,
          maxBodyLength: Infinity,
          responseType: "arraybuffer",
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        });
        r.data && console.log("Image received");
        const binaryData = new Uint8Array(r.data);
        const buffer = Buffer.from(binaryData);
        const base64String =
          `data:${mimeType};base64,` + buffer.toString("base64");
        reply = await repli(base64String);
      }

      sendMessage(phone_number_id, from, reply);
    }
    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

//Replicate Part

const repli = async (imageURL) => {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
    fetch: fetch,
  });

  const model =
    "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b";
  const input = {
    image: imageURL,
    scale: 8,
    face_enhance: true,
  };
  const output = await replicate.run(model, { input }).catch((error) => {
    console.log("Repli Error: " + error);
    return "Sorry, I'm having trouble with image upscaling right now. Contact Priyansu Choudhury on Whatsapp at +917008339883 for help.";
  });
  return output;
};

const repliPrompt = async (prompt) => {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
    fetch: fetch,
  });

  const model =
    "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf";

  const input = {
    prompt: prompt,
    scale: 5,
    face_enhance: true,
  };
  const output = await replicate
    .run(model, { input })
    .then((out) => {
      return out[0];
    })
    .catch((error) => {
      console.log("Repli Error: " + error);
      return "Sorry, I'm having trouble with image generation right now. Contact Priyansu Choudhury on Whatsapp at +917008339883 for help.";
    });
  return output;
};

app.use(express.static("public"));
app.use(express.static("dist"));

app.get("^/$", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

app.listen(6000 || process.env.PORT, () =>
  console.log("Server is running on port " + process.env.PORT)
);
