import express from "express";
import bodyParser from "body-parser";
import { Configuration, OpenAIApi } from "openai";
import path from "path";
import axios from "axios";
import Replicate from "replicate";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
async function botMessage(prompt) {
  const completion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: prompt,
    max_tokens: 2048,
    temperature: 0.7,
    top_p: 1,
    presence_penalty: 0,
    frequency_penalty: 0,
  });
  return completion.data.choices[0].text;
}

//Whatsapp Part

const app = express();
app.use(bodyParser.json());

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
    const { entry } = req.body;
    const { phone_number_id, from, message } = entry[0].changes[0].value;

    let reply = "Hey";

    if (message && message.text && message.text.body) {
      const prompt = message.text.body.trim();

      if (prompt.startsWith("/imagine")) {
        const repliResponse = await repliPrompt(prompt.replace("/imagine", ""));
        reply = repliResponse[0];
      } else {
        reply = await botMessage(prompt);
      }
    } else if (message && message.image && message.image.id) {
      const { id } = message.image;
      const response = await axios({
        method: "GET",
        url: `https://graph.facebook.com/v15.0/${id}`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
      });

      const { url, mime_type: mimeType } = response.data;

      const imageResponse = await axios({
        method: "GET",
        url,
        maxBodyLength: Infinity,
        responseType: "arraybuffer",
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const binaryData = new Uint8Array(imageResponse.data);
      const buffer = Buffer.from(binaryData);
      const base64String = `data:${mimeType};base64,${buffer.toString("base64")}`;

      const repliResponse = await repli(base64String);
      reply = repliResponse;
    }

    sendMessage(phone_number_id, from, reply);
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
  const output = await replicate.run(model, { input });
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
    scale: 8,
    face_enhance: true,
  };
  const output = await replicate.run(model, { input });
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
